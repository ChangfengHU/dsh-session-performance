import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { transformRuntime } from '../src/runtime-transform.js';
import { pageSummaries } from '../src/read-model.js';

const root = process.env.DSH_INSTALL_ROOT;
test('installed native runtime uses real paged reads, search hydration, mutations and reconnect', { skip: !root }, async () => {
  const source = fs.readFileSync(root + '/node_modules/@deepseek-ai/dsh-client-runtime/lib/client.js', 'utf8');
  assert.throws(() => transformRuntime(source.replace('buildListSnapshot() {', 'drifted() {')));
  const require = createRequire(root + '/package.json');
  const rows = Array.from({ length: 1000 }, (_, i) => ({ sessionId: 's-' + i, updatedAt: i + 1, cwd: '/w', running: false, blank: false }));
  let exports, count = 0;
  const context = vm.createContext({ window: { __ModuleLoader__: { load(reg) { exports = reg.factory(id => id === '@deepseek-ai/dsh-client-ui-slots' ? {} : require(id)); } } }, console, setTimeout, clearTimeout, queueMicrotask, URL, crypto,
    requestAnimationFrame: fn => setTimeout(fn, 0), cancelAnimationFrame: clearTimeout,
    localStorage: { getItem: () => null, setItem() {} }, location: { href: 'http://localhost/?session=s-0' },
    fetch: async (_, options) => { count++; return { ok: true, json: async () => ({ result: { ok: true, value: pageSummaries(rows, JSON.parse(options.body).payload) } }) }; },
  });
  new vm.Script(transformRuntime(source)).runInContext(context);
  const { Context } = require('@deepseek-ai/cordis');
  const runtime = new exports.SessionRuntime(new Context(), { sessions: { search: async () => ({ result: { ok: true, value: { items: [{ sessionId: 's-7' }] } } }) } }, {});
  await runtime.refresh();
  assert.equal(runtime.list.getSnapshot().ids.length, 31);
  assert.ok(runtime.list.getSnapshot().byId['s-0']);
  await Promise.all([runtime.loadMore(), runtime.loadMore()]);
  assert.equal(runtime.list.getSnapshot().ids.length, 61); assert.equal(count, 2);
  await runtime.search('older'); assert.ok(runtime.list.getSnapshot().byId['s-7']);
  runtime.manager.recordMutation({ kind: 'upsert', summary: { sessionId: 'live', updatedAt: 9999, cwd: '/w', running: true } });
  await new Promise(resolve => setTimeout(resolve, 10)); assert.ok(runtime.list.getSnapshot().byId.live);
  runtime.handleDisconnected(); runtime.handleConnected(); await runtime.refresh();
  assert.ok(runtime.list.getSnapshot().byId['s-7']);
  assert.equal(new Set(runtime.list.getSnapshot().ids).size, runtime.list.getSnapshot().ids.length);
});
