import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const sql = fs.readFileSync('supabase/migrations/20260927092548_admin_management_atomic.sql', 'utf8');
// These are design regression checks, NOT a PostgreSQL execution test.
test('SQL design: one transaction advisory lock precedes reads and every mutation', () => {
  const lock = sql.indexOf('perform pg_catalog.pg_advisory_xact_lock(184732, 1)');
  assert.ok(lock > 0);
  for (const fragment of ['select * into actor', 'select * into old_profile', 'delete from public.admin_permission_overrides', 'insert into public.admin_permission_overrides', 'update public.admin_profiles']) assert.ok(sql.indexOf(fragment) > lock);
  assert.match(sql, /volatile security invoker/);
  assert.match(sql, /transaction_isolation.*<> 'read committed'/);
  assert.doesNotMatch(sql, /pg_advisory_unlock|\bcommit\s*;/i);
});
test('SQL design: last capable super admin invariant rolls back profile AND override writes', () => {
  assert.match(sql, /p.role_key = 'super_admin' and p.is_active/);
  assert.match(sql, /o.effect = 'deny' and o.permission_key = any\(critical\)/);
  assert.match(sql, /errcode = '23514', message = 'LAST_SUPER_ADMIN'/);
  assert.ok(sql.indexOf("message = 'LAST_SUPER_ADMIN'") > sql.indexOf('update public.admin_profiles'));
  assert.ok(sql.indexOf("message = 'LAST_SUPER_ADMIN'") < sql.indexOf('insert into public.admin_audit_logs'));
});
test('SQL design: service-role-only invoker, safe search_path, authenticated actor recheck', () => {
  assert.match(sql, /set search_path = pg_catalog/);
  assert.match(sql, /revoke all on function .* from public, anon, authenticated/);
  assert.match(sql, /grant execute on function .* to service_role/);
  assert.match(sql, /actor.role_key is distinct from 'super_admin'/);
  assert.match(sql, /o.user_id = p_actor.*o.permission_key = permission.*o.effect = 'deny'/s);
});
test('SQL design: self protection, inherit deletion scoped to exact user/permission, audited changes', () => {
  assert.match(sql, /p_target = p_actor and p_effect = 'deny'/);
  assert.match(sql, /p_actor = p_target and/);
  assert.match(sql, /delete from public.admin_permission_overrides where user_id = p_target and permission_key = p_permission/);
  for (const action of ['admins.edit', 'admins.role.change', 'admins.enable', 'admins.disable', 'admins.permissions.change']) assert.ok(sql.includes(`'${action}'`));
  assert.doesNotMatch(sql, /jsonb_build_object\('password'|'token'|'recovery_link'/);
});
