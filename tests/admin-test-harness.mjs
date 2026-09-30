// Loads the actual TS route handlers and guard with isolated, in-memory Supabase.
// No environment credentials, HTTP calls, or production writes are used.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);

class NextRequest {
  constructor(url, init = {}) {
    this.url = url;
    this.method = init.method || 'GET';
    this.headers = new Headers(init.headers);
    this.cookies = { getAll: () => [] };
    this.nextUrl = new URL(url);
    this._body = init.body;
  }

  async json() {
    return JSON.parse(this._body);
  }
}

class NextResponse extends Response {
  static json(body, init = {}) {
    return new NextResponse(JSON.stringify(body), { ...init, headers: { 'content-type': 'application/json' } });
  }

  async json() {
    return JSON.parse(await this.text());
  }
}
export const ACTOR = '00000000-0000-4000-8000-000000000001';
export const TARGET = '00000000-0000-4000-8000-000000000002';
export const CREATED = '00000000-0000-4000-8000-000000000003';
export function harness() {
  const state = { userId: ACTOR, tables: {}, calls: [], profileFailure: false, cleanupFailure: false, authFailure: false, rpcError: null, lookupError: null, recoveryError: null };
  const cache = new Map();
  const db = {
    from(table) {
      const filters = []; let selected = '*', operation = 'select', payload, single = false, start = 0, end = Infinity, conflictKey;
      const query = {
        select(columns) { selected = columns; return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        in(key, values) { filters.push(row => values.includes(row[key])); return query; },
        gte(key, value) { filters.push(row => row[key] >= value); return query; },
        lt(key, value) { filters.push(row => row[key] < value); return query; },
        order() { return query; }, range(a, b) { start = a; end = b; return query; },
        maybeSingle() { single = true; return query; }, single() { single = true; return query; },
        insert(value) { operation = 'insert'; payload = value; return query; },
        upsert(value, options = {}) { operation = 'upsert'; payload = value; conflictKey = options.onConflict; return query; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            state.calls.push({ table, operation, payload });
            if (operation === 'insert') {
              if (table === 'admin_profiles' && state.profileFailure) return { data: null, error: { code: 'FAIL' } };
              (state.tables[table] ??= []).push(payload);
              return { data: payload, error: null };
            }
            if (operation === 'upsert') {
              const rows = (state.tables[table] ??= []);
              const index = conflictKey ? rows.findIndex(row => row[conflictKey] === payload[conflictKey]) : -1;
              if (index >= 0) rows[index] = { ...rows[index], ...payload };
              else rows.push(payload);
              return { data: index >= 0 ? rows[index] : payload, error: null };
            }
            const rows = (state.tables[table] ?? []).filter(row => filters.every(f => f(row)));
            const projected = rows.slice(start, end + 1).map(row => selected === '*' ? row : Object.fromEntries(selected.split(',').map(key => [key.trim(), row[key.trim()]])));
            return { data: single ? projected[0] ?? null : projected, count: rows.length, error: null };
          }).then(resolve, reject);
        },
      };
      return query;
    },
    auth: {
      admin: {
        async getUserById(id) { return { data: { user: { id, email: `${id}@example.test`, last_sign_in_at: '2026-09-01T00:00:00Z', app_metadata: { secret: 'never expose' } } }, error: state.lookupError }; },
        async createUser(input) { state.calls.push({ createAuth: true }); return { data: { user: state.authFailure ? null : { id: CREATED, email: input.email } }, error: state.authFailure ? { message: 'sensitive upstream details' } : null }; },
        async deleteUser(id) { state.calls.push({ deleteAuth: id }); return { error: state.cleanupFailure ? {} : null }; },
      },
      async resetPasswordForEmail(email, options) { state.calls.push({ recovery: email, options }); return { error: state.recoveryError }; },
    },
    async rpc(name, args) { state.calls.push({ rpc: name, args }); return { data: { user_id: args.p_target }, error: state.rpcError }; },
  };
  function load(relative) {
    const filename = path.resolve(relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} }; cache.set(filename, loadedModule);
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    function localRequire(id) {
      if (id === 'server-only') return {};
      if (id === 'next/server') return { NextRequest, NextResponse };
      if (id === 'next/headers') return { cookies: async () => ({ getAll: () => [] }) };
      if (id === 'next/navigation') return { redirect: () => { throw new Error('REDIRECT'); } };
      if (id === '@supabase/ssr') return { createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: state.userId ? { id: state.userId } : null } }) } }) };
      if (id === '@/lib/supabase/server') return { createServiceRoleClient: () => db };
      if (id.startsWith('@/') || id.startsWith('.')) return load((id.startsWith('@/') ? id.slice(2) : path.resolve(path.dirname(filename), id)) + (id.endsWith('.ts') ? '' : '.ts'));
      return require(id);
    }
    new Function('require', 'module', 'exports', compiled)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  const permissions = load('lib/admin/permissions.ts');
  state.tables.admin_profiles = [
    { user_id: ACTOR, display_name: 'Actor', role_key: 'super_admin', is_active: true, created_at: '2026-09-01T00:00:00Z' },
    { user_id: TARGET, display_name: 'Target', role_key: 'viewer', is_active: true, created_at: '2026-09-01T00:00:00Z' },
  ];
  state.tables.admin_roles = permissions.ADMIN_ROLES.map(key => ({ key, name: key === 'supervisor' ? 'المشرف العام' : key }));
  state.tables.admin_permissions = permissions.ADMIN_PERMISSIONS.map(key => ({ key, name: key }));
  state.tables.admin_role_permissions = permissions.ADMIN_ROLES.flatMap(role => permissions.getRolePermissions(role).map(permission => ({ role_key: role, permission_key: permission })));
  state.tables.admin_permission_overrides = [];
  state.tables.admin_audit_logs = [];
  return {
    state, load, permissions,
    role(role, active = true) { Object.assign(state.tables.admin_profiles[0], { role_key: role, is_active: active }); },
    request(method = 'GET', body, url = '/api/admin/admins') { return new NextRequest(`https://matrouhcup.online${url}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) }); },
    context(id = TARGET) { return { params: Promise.resolve({ userId: id }) }; },
  };
}
