import assert from 'node:assert/strict';
import test from 'node:test';
import { harness, ACTOR, TARGET, CREATED } from './admin-test-harness.mjs';
const root = 'app/api/admin/admins/route.ts';
const detail = 'app/api/admin/admins/[userId]/route.ts';
const overrides = 'app/api/admin/admins/[userId]/permissions/route.ts';
const reset = 'app/api/admin/admins/[userId]/password-reset/route.ts';
const createInput = { display_name: 'New admin', email: 'new@example.test', password: 'strong-secret-123', role_key: 'viewer', is_active: true };

for (const role of ['super_admin', 'supervisor']) test(`${role}: list and details return sanitized data`, async () => {
  const h = harness(); h.role(role);
  const list = await h.load(root).GET(h.request()); assert.equal(list.status, 200);
  const body = await list.json(); assert.equal(body.admins.length, 2); assert.equal(body.roles.find(r => r.key === 'supervisor').name, 'المشرف العام');
  const result = await h.load(detail).GET(h.request(), h.context()); assert.equal(result.status, 200);
  const data = await result.json(); assert.equal(data.permissions.length, 56); assert.match(data.admin.email, /example.test/);
  assert.doesNotMatch(JSON.stringify([body, data]), /app_metadata|never expose|token|password":/);
});
test('create writes profile and audit without password and returns 201', async () => {
  const h = harness(); const result = await h.load(root).POST(h.request('POST', createInput));
  assert.equal(result.status, 201); assert.equal((await result.json()).admin.user_id, CREATED);
  assert.equal(h.state.tables.admin_audit_logs[0].action, 'admins.create');
  assert.doesNotMatch(JSON.stringify(h.state.tables), /strong-secret|password":/);
});
test('profile creation failure cleans only the new Auth user; cleanup failure is explicit', async () => {
  for (const failedCleanup of [false, true]) {
    const h = harness(); h.state.profileFailure = true; h.state.cleanupFailure = failedCleanup;
    const result = await h.load(root).POST(h.request('POST', createInput)); assert.equal(result.status, 500);
    assert.deepEqual(h.state.calls.filter(c => c.deleteAuth).map(c => c.deleteAuth), [CREATED]);
    assert.equal(h.state.tables.admin_audit_logs.length, 0);
    if (failedCleanup) assert.match((await result.json()).error, /تدخل فني/);
  }
});
test('failed Auth creation never deletes an existing identity', async () => {
  const h = harness(); h.state.authFailure = true;
  assert.equal((await h.load(root).POST(h.request('POST', createInput))).status, 400);
  assert.equal(h.state.calls.some(c => c.deleteAuth), false);
});
for (const [name, patch] of Object.entries({ edit: { display_name: 'Edited' }, enable: { is_active: true }, disable: { is_active: false }, role: { role_key: 'supervisor' } })) test(`super admin ${name} uses authenticated actor and atomic RPC`, async () => {
  const h = harness(); const result = await h.load(detail).PATCH(h.request('PATCH', patch), h.context());
  assert.equal(result.status, 200);
  const call = h.state.calls.find(c => c.rpc); assert.equal(call.rpc, 'admin_management_mutate'); assert.equal(call.args.p_actor, ACTOR); assert.equal(call.args.p_target, TARGET); assert.deepEqual(call.args.p_patch, patch);
});
for (const effect of ['allow', 'deny', 'inherit']) test(`override ${effect} calls shared atomic operation`, async () => {
  const h = harness(); assert.equal((await h.load(overrides).PATCH(h.request('PATCH', { permission_key: 'matches.edit', effect }), h.context())).status, 200);
  assert.equal(h.state.calls.find(c => c.rpc).args.p_effect, effect);
});
test('password reset sends recovery email to stored address and fixed application route', async () => {
  const h = harness(); assert.equal((await h.load(reset).POST(h.request('POST', { email: 'attacker@example.test', redirectTo: 'https://evil.test' }), h.context())).status, 200);
  const call = h.state.calls.find(c => c.recovery); assert.equal(call.recovery, `${TARGET}@example.test`); assert.equal(call.options.redirectTo, 'https://matrouhcup.online/admin/reset-password');
  assert.equal(h.state.tables.admin_audit_logs[0].action, 'admins.password.reset'); assert.deepEqual(h.state.tables.admin_audit_logs[0].metadata, {});
});
for (const [route, method, body] of [[root, 'POST', createInput], [detail, 'PATCH', { display_name: 'Edited' }], [detail, 'PATCH', { is_active: false }], [overrides, 'PATCH', { permission_key: 'matches.edit', effect: 'allow' }], [reset, 'POST', {}]]) test(`supervisor denied ${route} ${JSON.stringify(body).slice(0, 30)}`, async () => {
  const h = harness(); h.role('supervisor');
  const result = await h.load(route)[method](h.request(method, body), h.context()); assert.equal(result.status, 403); assert.equal(h.state.calls.some(c => c.rpc || c.createAuth || c.recovery), false);
});
test('supervisor with an account ALLOW remains read-only', async () => {
  const h = harness(); h.role('supervisor'); h.state.tables.admin_permission_overrides.push({ user_id: ACTOR, permission_key: 'admins.edit', effect: 'allow' });
  assert.equal((await h.load(detail).PATCH(h.request('PATCH', { role_key: 'viewer' }), h.context())).status, 403);
});
test('specialized role, inactive admin and unauthenticated requests are denied', async () => {
  const h = harness(); h.role('match_manager'); assert.equal((await h.load(root).GET(h.request())).status, 403);
  h.role('super_admin', false); assert.equal((await h.load(root).GET(h.request())).status, 403);
  h.state.userId = null; assert.equal((await h.load(root).GET(h.request())).status, 401);
});
test('self disable, demotion and every critical self DENY blocked before RPC', async () => {
  const h = harness();
  for (const body of [{ is_active: false }, { role_key: 'viewer' }]) assert.equal((await h.load(detail).PATCH(h.request('PATCH', body), h.context(ACTOR))).status, 409);
  for (const permission_key of h.load('lib/admin/management.ts').criticalPermissions) assert.equal((await h.load(overrides).PATCH(h.request('PATCH', { permission_key, effect: 'deny' }), h.context(ACTOR))).status, 409);
  assert.equal(h.state.calls.some(c => c.rpc), false);
});
test('mixed patch requires both edit and disable permissions; body cannot spoof actor', async () => {
  const h = harness(); h.state.tables.admin_permission_overrides.push({ user_id: ACTOR, permission_key: 'admins.edit', effect: 'deny' });
  assert.equal((await h.load(detail).PATCH(h.request('PATCH', { is_active: true, role_key: 'super_admin' }), h.context())).status, 403);
  h.state.tables.admin_permission_overrides = [];
  for (const patch of [{ actor: TARGET, is_active: false }, { user_id: TARGET }, { email: 'x@y.test' }, { is_active: 'false' }, { role_key: null }]) assert.equal((await h.load(detail).PATCH(h.request('PATCH', patch), h.context())).status, 400);
});
test('last-super-admin RPC rejection is mapped to 409, missing migration fails closed', async () => {
  const h = harness(); h.state.rpcError = { code: '23514' };
  for (const patch of [{ is_active: false }, { role_key: 'viewer' }]) assert.equal((await h.load(detail).PATCH(h.request('PATCH', patch), h.context())).status, 409);
  assert.equal((await h.load(overrides).PATCH(h.request('PATCH', { permission_key: 'admins.view', effect: 'deny' }), h.context())).status, 409);
  h.state.rpcError = { code: 'PGRST202' }; assert.equal((await h.load(detail).PATCH(h.request('PATCH', { is_active: false }), h.context())).status, 503);
});
test('super admin DENY is honored by real guard and details resolver', async () => {
  const h = harness(); h.state.tables.admin_permission_overrides.push({ user_id: ACTOR, permission_key: 'admins.create', effect: 'deny' });
  assert.equal((await h.load(root).POST(h.request('POST', createInput))).status, 403);
  const response = await h.load(detail).GET(h.request(), h.context(ACTOR)); assert.equal((await response.json()).effectivePermissions.includes('admins.create'), false);
});
