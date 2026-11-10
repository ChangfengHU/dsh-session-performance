import test from 'node:test';
import assert from 'node:assert/strict';
import { pageSummaries, chatHistory, createReads } from '../src/read-model.js';
import { lazySource, aliasBundle, rewriteBoot } from '../src/lazy-ui.js';
import vm from 'node:vm';

const rows = Array.from({ length: 1000 }, (_, i) => ({ sessionId: 's-' + String(i).padStart(4, '0'), updatedAt: Math.floor(i / 3), title: 'Session ' + i, cwd: '/workspace' }));
test('1000 sessions page without duplicates, omissions or timestamp tie instability', () => {
  let cursor, seen = [];
  do { const page = pageSummaries(rows, { cursor }); assert.ok(page.items.length <= 30); seen.push(...page.items.map(row => row.sessionId)); cursor = page.nextCursor; } while (cursor);
  assert.equal(seen.length, 1000); assert.equal(new Set(seen).size, 1000);
});
test('pinned old links include visible parents, never synthesize unlisted assets', () => {
  const data = rows.map(row => row.sessionId === 's-0000' ? { ...row, parentSessionId: 's-0001' } : row);
  const page = pageSummaries(data, { includeIds: ['s-0000', 'private-session'] });
  assert.ok(page.items.some(row => row.sessionId === 's-0000'));
  assert.ok(page.items.some(row => row.sessionId === 's-0001'));
  assert.ok(!page.items.some(row => row.sessionId === 'private-session'));
});
test('cursor uses ordering rather than array offset when a new session arrives', () => {
  const first = pageSummaries(rows); const second = pageSummaries([{ sessionId: 'new', updatedAt: 9999 }, ...rows], { cursor: first.nextCursor });
  assert.ok(second.items.every(row => !first.items.some(first => first.sessionId === row.sessionId)));
  for (const input of [{ limit: 0 }, { limit: 1000 }, { cursor: 'bad' }, { includeIds: [3] }]) assert.throws(() => pageSummaries(rows, input));
});
test('Chat projection preserves every sequence and tool/approval event without mutating full evidence', () => {
  const value = { hasMore: true, events: [
    { event: { seq: 0, type: 'request/header', data: { reason: 'step', header: { model: 'm', system: 'x'.repeat(200000), tools: [{ name: 'read' }], messages: ['private'] } } } },
    { event: { seq: 1, type: 'tool/result', data: { result: 'actual' } } },
    { event: { seq: 2, type: 'approval/requested', data: { id: 'a' } } },
  ], projections: { asOfSeq: 2, values: { contextHeaders: { big: 'x'.repeat(200000) }, title: 'Keep title' } } };
  const before = JSON.stringify(value), projected = chatHistory(value);
  assert.equal(JSON.stringify(value), before);
  assert.deepEqual(projected.events.map(row => row.event.seq), [0, 1, 2]);
  assert.equal(projected.events[1], value.events[1]); assert.equal(projected.events[2], value.events[2]);
  assert.equal(projected.projections.values.title, 'Keep title'); assert.ok(!projected.projections.values.contextHeaders);
  assert.ok(JSON.stringify(projected).length < 1000);
});
test('full diagnostics and denial propagate from the native authority gateway', async () => {
  const value = { events: [], projections: { values: { contextHeaders: 'full' } } };
  const api = { sessions: { list: async () => ({ result: { ok: true, value: { items: rows } } }), history: async request => request.payload.sessionId === 'denied' ? { result: { ok: false, error: { code: 'not-found', message: 'denied' } } } : { result: { ok: true, value } } } };
  const read = createReads(api);
  assert.equal((await read('history', { sessionId: 's', diagnostics: true })).value, value);
  assert.equal((await read('history', { sessionId: 'denied' })).error.message, 'denied');
  assert.equal((await read('list', {})).value.items.length, 30);
});
test('lazy stubs are valid classic CJS, revisioned boot retains security-critical modules', () => {
  const stub = lazySource('dsh-context', '/session-performance/assets/abc-full.js', ['react']);
  new vm.Script(stub); assert.ok(!stub.includes('eval('));
  assert.match(aliasBundle('window.__ModuleLoader__.load({ id: "dsh-context", factory: () => { var module = { exports: {} }; ctx.slots.register(); return {}; } });', 'dsh-context'), /dsh-context~deferred/);
  assert.throws(() => aliasBundle('invalid', 'dsh-context'));
  const boot = { rev: 'a', entries: [{ id: 'dsh-context', url: '/plugins/dsh-context/client.js?rev=x' }, { id: 'permissions', url: '/permissions.js' }] };
  const html = '<head><link rel="preload" href="/plugins/dsh-context/client.js?rev=x"></head><script>globalThis["__DSH_BOOT__"] = ' + JSON.stringify(boot) + ';</script>';
  const next = rewriteBoot(html, new Map([['dsh-context', { url: '/lazy.js', rev: 'b' }]]));
  assert.match(next, /permissions.js/); assert.match(next, /lazy.js/); assert.doesNotMatch(next, /rel="preload"/);
});
