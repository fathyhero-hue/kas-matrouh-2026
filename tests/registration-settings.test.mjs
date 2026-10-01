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

test('date-only registration deadlines are inclusive in the Cairo timezone', () => {
  const h = harness();
  const settings = h.load('lib/sport/registration-settings.ts');
  assert.equal(settings.isRegistrationOpen('2026-10-02', new Date('2026-10-01T23:59:59.999+03:00')), true);
  assert.equal(settings.isRegistrationOpen('2026-10-01', new Date('2026-10-01T23:59:59.999+03:00')), true);
  assert.equal(settings.isRegistrationOpen('2026-10-01', new Date('2026-10-02T00:00:00.000+03:00')), false);
  assert.equal(settings.isRegistrationOpen('2026-09-30', new Date('2026-10-01T12:00:00.000+03:00')), false);
  assert.equal(settings.isRegistrationOpen(null, new Date('2026-10-01T12:00:00.000+03:00')), true);
});

test('Elite unlock uses the elite settings row and accepts the shared code while open', async () => {
  const h = harness();
  h.state.tables.registration_settings = [{ tournament: 'elite', deadline: '2099-12-31', password: 'shared-code' }];
  const response = await h.load('app/api/roster/unlock/route.ts').POST(h.request('POST', { tournament: 'elite_cup', code: 'shared-code' }, '/api/roster/unlock'));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  assert.equal(h.state.calls.find(call => call.table === 'registration_settings').payload, undefined);
});

test('Elite unlock returns a clear expired-deadline error and does not try the password RPC', async () => {
  const h = harness();
  h.state.tables.registration_settings = [{ tournament: 'elite', deadline: '2026-09-30', password: 'shared-code' }];
  const response = await h.load('app/api/roster/unlock/route.ts').POST(h.request('POST', { tournament: 'elite_cup', code: 'wrong-code' }, '/api/roster/unlock'));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'انتهت فترة تقديم وتعديل القوائم');
  assert.equal(h.state.calls.some(call => call.rpc), false);
});

test('Elite unlock rejects a wrong code with the dedicated code error', async () => {
  const h = harness();
  h.state.tables.registration_settings = [{ tournament: 'elite', deadline: '2099-12-31', password: 'shared-code' }];
  const response = await h.load('app/api/roster/unlock/route.ts').POST(h.request('POST', { tournament: 'elite_cup', code: 'wrong-code' }, '/api/roster/unlock'));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'الرقم السري غير صحيح');
});
