-- Local review artifact only. Does not alter the deployed RBAC foundation.
-- All admin-management profile/override writes must use this RPC. Direct service
-- role SQL remains a trusted maintenance capability, outside the HTTP API.
create function public.admin_management_mutate(
  p_actor uuid,
  p_target uuid,
  p_patch jsonb default '{}'::jsonb,
  p_permission text default null,
  p_effect text default null
) returns jsonb
language plpgsql volatile security invoker
set search_path = pg_catalog
as $$
declare
  actor public.admin_profiles%rowtype;
  old_profile public.admin_profiles%rowtype;
  new_profile public.admin_profiles%rowtype;
  required_permissions text[] := array[]::text[];
  critical constant text[] := array['admins.view','admins.create','admins.edit',
    'admins.disable','admins.permissions.manage','admins.reset_password'];
  permission text;
begin
  -- VOLATILE statements at READ COMMITTED see the previous lock holder's commit.
  -- Reject snapshot isolation instead of checking a stale snapshot after waiting.
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = '40001', message = 'READ_COMMITTED_REQUIRED';
  end if;
  -- Transaction-scoped, application-specific lock: serializes only admin mutations,
  -- including overrides and demotions together. Released on commit AND rollback.
  perform pg_catalog.pg_advisory_xact_lock(184732, 1);
  if p_actor is null or p_target is null or p_patch is null
     or jsonb_typeof(p_patch) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_INPUT';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) k
             where k not in ('display_name','role_key','is_active')) then
    raise exception using errcode = '22023', message = 'INVALID_FIELD';
  end if;
  if p_permission is not null then
    if p_patch <> '{}'::jsonb or p_effect is null or p_effect not in ('allow','deny','inherit')
       or not exists (select 1 from public.admin_permissions where key = p_permission) then
      raise exception using errcode = '22023', message = 'INVALID_OVERRIDE';
    end if;
    required_permissions := array['admins.permissions.manage'];
  else
    if p_patch = '{}'::jsonb or p_effect is not null then
      raise exception using errcode = '22023', message = 'EMPTY_PATCH';
    end if;
    if p_patch ? 'display_name' or p_patch ? 'role_key' then
      required_permissions := array_append(required_permissions, 'admins.edit');
    end if;
    if p_patch ? 'is_active' then
      required_permissions := array_append(required_permissions, 'admins.disable');
    end if;
  end if;
  select * into actor from public.admin_profiles where user_id = p_actor;
  if not found or actor.is_active is distinct from true or actor.role_key is distinct from 'super_admin' then
    raise exception using errcode = '42501', message = 'ACTOR_FORBIDDEN';
  end if;
  -- Recheck actor after acquiring lock, closing the authorize-then-demote race.
  foreach permission in array required_permissions loop
    if exists (select 1 from public.admin_permission_overrides o
               where o.user_id = p_actor and o.permission_key = permission and o.effect = 'deny') then
      raise exception using errcode = '42501', message = 'PERMISSION_DENIED';
    end if;
  end loop;
  select * into old_profile from public.admin_profiles where user_id = p_target for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ADMIN_NOT_FOUND';
  end if;
  if p_permission is not null then
    if p_target = p_actor and p_effect = 'deny' and p_permission = any(critical) then
      raise exception using errcode = '23514', message = 'SELF_LOCKOUT';
    end if;
    if p_effect = 'inherit' then
      delete from public.admin_permission_overrides where user_id = p_target and permission_key = p_permission;
    else
      insert into public.admin_permission_overrides(user_id, permission_key, effect)
      values (p_target, p_permission, p_effect)
      on conflict (user_id, permission_key) do update set effect = excluded.effect, updated_at = now();
    end if;
  else
    if p_patch ? 'display_name' and (jsonb_typeof(p_patch->'display_name') <> 'string'
       or length(btrim(p_patch->>'display_name')) not between 1 and 100) then
      raise exception using errcode = '22023', message = 'INVALID_NAME';
    end if;
    if p_patch ? 'role_key' and (jsonb_typeof(p_patch->'role_key') <> 'string'
       or not exists (select 1 from public.admin_roles where key = p_patch->>'role_key')) then
      raise exception using errcode = '22023', message = 'INVALID_ROLE';
    end if;
    if p_patch ? 'is_active' and jsonb_typeof(p_patch->'is_active') <> 'boolean' then
      raise exception using errcode = '22023', message = 'INVALID_STATUS';
    end if;
    if p_actor = p_target and ((p_patch ? 'is_active' and not (p_patch->>'is_active')::boolean)
       or (p_patch ? 'role_key' and p_patch->>'role_key' <> 'super_admin')) then
      raise exception using errcode = '23514', message = 'SELF_LOCKOUT';
    end if;
    update public.admin_profiles set
      display_name = case when p_patch ? 'display_name' then btrim(p_patch->>'display_name') else display_name end,
      role_key = coalesce(p_patch->>'role_key', role_key),
      is_active = coalesce((p_patch->>'is_active')::boolean, is_active),
      updated_at = now()
    where user_id = p_target;
  end if;
  -- Require a functioning administrator, not merely a role label. This also blocks
  -- demoting the remaining capable admin when another super admin has critical DENYs.
  if not exists (
    select 1 from public.admin_profiles p
    where p.role_key = 'super_admin' and p.is_active
      and not exists (select 1 from public.admin_permission_overrides o
        where o.user_id = p.user_id and o.effect = 'deny' and o.permission_key = any(critical))
  ) then
    raise exception using errcode = '23514', message = 'LAST_SUPER_ADMIN';
  end if;
  select * into new_profile from public.admin_profiles where user_id = p_target;
  -- Mutation and its audit commit together; failure rolls both back. No request
  -- bodies, passwords, tokens or recovery links are accepted by this function.
  if p_permission is not null then
    insert into public.admin_audit_logs(actor_user_id,action,permission_key,entity_type,entity_id,metadata)
    values(p_actor,'admins.permissions.change','admins.permissions.manage','admin_profile',p_target::text,
      jsonb_build_object('changed_fields',jsonb_build_array(p_permission,p_effect)));
  else
    if old_profile.display_name is distinct from new_profile.display_name then
      insert into public.admin_audit_logs(actor_user_id,action,permission_key,entity_type,entity_id,metadata)
      values(p_actor,'admins.edit','admins.edit','admin_profile',p_target::text,
        '{"changed_fields":["display_name"]}'::jsonb);
    end if;
    if old_profile.role_key is distinct from new_profile.role_key then
      insert into public.admin_audit_logs(actor_user_id,action,permission_key,entity_type,entity_id,metadata)
      values(p_actor,'admins.role.change','admins.edit','admin_profile',p_target::text,
        '{"changed_fields":["role_key"]}'::jsonb);
    end if;
    if old_profile.is_active is distinct from new_profile.is_active then
      insert into public.admin_audit_logs(actor_user_id,action,permission_key,entity_type,entity_id,metadata)
      values(p_actor,case when new_profile.is_active then 'admins.enable' else 'admins.disable' end,
        'admins.disable','admin_profile',p_target::text,'{"changed_fields":["is_active"]}'::jsonb);
    end if;
  end if;
  return jsonb_build_object('user_id',new_profile.user_id,'display_name',new_profile.display_name,
    'role_key',new_profile.role_key,'is_active',new_profile.is_active,
    'created_at',new_profile.created_at,'last_login_at',new_profile.last_login_at);
end;
$$;

revoke all on function public.admin_management_mutate(uuid,uuid,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.admin_management_mutate(uuid,uuid,jsonb,text,text) to service_role;
