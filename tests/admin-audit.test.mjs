import assert from 'node:assert/strict';
import test from 'node:test';
import { harness, ACTOR } from './admin-test-harness.mjs';
test('audit writes exclude secrets and arbitrary metadata', async () => {
  const h = harness();
  await h.load('lib/admin/audit.ts').auditAdminMutation({ actorUserId: ACTOR, action: 'admins.password.reset', permission: 'admins.reset_password', entityType: 'admin_profile', request: h.request(), metadata: { password: 'SECRET', token: 'SECRET', recovery_link: 'SECRET', changed_fields: ['is_active'] } });
  const row = h.state.tables.admin_audit_logs[0]; assert.doesNotMatch(JSON.stringify(row), /SECRET|recovery_link|"token"|"password"/); assert.deepEqual(row.metadata, { changed_fields: ['is_active'] });
});
test('audit API paginates, filters, resolves actors and sanitizes existing metadata', async () => {
  const h = harness();
  h.state.tables.admin_audit_logs = Array.from({ length: 30 }, (_, id) => ({ id, actor_user_id: ACTOR, action: 'admins.edit', entity_type: 'admin_profile', entity_id: ACTOR, created_at: '2026-09-27T12:00:00Z', metadata: { password: 'SECRET', changed_fields: ['role_key', 'SECRET', 'token'] } }));
  const route = h.load('app/api/admin/audit/route.ts');
  const response = await route.GET(h.request('GET', undefined, `/api/admin/audit?page=2&actor=${ACTOR}&action=admins.edit&from=2026-09-27&to=2026-09-27`));
  assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.total, 30); assert.equal(body.logs.length, 5); assert.equal(body.logs[0].actor_name, 'Actor'); assert.equal(body.logs[0].action_label, 'تعديل بيانات مسؤول'); assert.equal(body.logs[0].resource_label, 'المسؤولون'); assert.doesNotMatch(JSON.stringify(body), /SECRET|token|password/);
  assert.equal((await route.GET(h.request('GET', undefined, '/api/admin/audit?from=2026-02-30'))).status, 400);
  h.role('match_manager'); assert.equal((await route.GET(h.request())).status, 403);
});
