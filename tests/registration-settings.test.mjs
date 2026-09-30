import assert from 'node:assert/strict';
import test from 'node:test';
import { harness } from './admin-test-harness.mjs';

const route = 'app/api/admin/registration-settings/route.ts';

test('GET requires roster view and returns the scoped settings row', async () => {
  const h = harness();
  h.role('viewer');
  h.state.tables.registration_settings = [{ tournament: 'elite', deadline: '2026-10-15', password: 'secret', price: 1500 }];
  const response = await h.load(route).GET(h.request('GET', undefined, '/api/admin/registration-settings?tournament=elite'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).settings.deadline, '2026-10-15');
});

test('super admin can save a valid deadline and the audit uses roster settings permission', async () => {
  const h = harness();
  const response = await h.load(route).POST(h.request('POST', { tournament: 'elite', deadline: '2026-10-20', password: 'new-secret', price: 1750 }));
  assert.equal(response.status, 200);
  assert.deepEqual(h.state.tables.registration_settings[0], { tournament: 'elite', deadline: '2026-10-20', password: 'new-secret', price: 1750 });
  assert.equal(h.state.tables.admin_audit_logs[0].permission_key, 'rosters.settings.manage');
});

test('users without roster settings permission, inactive admins, and explicit DENY are rejected', async () => {
  const h = harness();
  h.role('viewer');
  assert.equal((await h.load(route).POST(h.request('POST', { tournament: 'elite', deadline: '2026-10-20', password: '', price: 1500 }))).status, 403);

  h.role('registration_manager', false);
  assert.equal((await h.load(route).POST(h.request('POST', { tournament: 'elite', deadline: '2026-10-20', password: '', price: 1500 }))).status, 403);

  h.role('super_admin', true);
  h.state.tables.admin_permission_overrides.push({ user_id: h.state.userId, permission_key: 'rosters.settings.manage', effect: 'deny' });
  assert.equal((await h.load(route).POST(h.request('POST', { tournament: 'elite', deadline: '2026-10-20', password: '', price: 1500 }))).status, 403);
  assert.equal(h.state.calls.some(call => call.table === 'registration_settings' && call.operation === 'upsert'), false);
});

test('invalid deadlines fail before any database write', async () => {
  const h = harness();
  const response = await h.load(route).POST(h.request('POST', { tournament: 'elite', deadline: '2026-02-30', password: '', price: 1500 }));
  assert.equal(response.status, 400);
  assert.equal(h.state.calls.some(call => call.table === 'registration_settings'), false);
});
