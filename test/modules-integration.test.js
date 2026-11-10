import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transformModules } from '../src/modules-transform.js';

test('native loader starts sibling dependencies concurrently and registers each bundle once', { skip: !process.env.DSH_INSTALL_ROOT }, async () => {
  const source = fs.readFileSync(process.env.DSH_INSTALL_ROOT + '/node_modules/@deepseek-ai/dsh-client-modules/lib/client.js', 'utf8');
  let exports;
  new vm.Script(transformModules(source)).runInNewContext({ window: { __ModuleLoader__: { load(reg) { exports = reg.factory(() => { throw new Error('Unexpected loader dependency'); }); } } }, console });
  assert.throws(() => transformModules(source.replace('for (const request of row.external)', 'for (const request of changed.external)')));
  const started = [], releases = new Map(); let loader;
  const manifest = { rev: 'test', modules: [
    { id: 'a', url: 'a', rev: '1', external: [] }, { id: 'b', url: 'b', rev: '1', external: [] },
    { id: 'root', url: 'root', rev: '1', external: ['a', 'b'] },
  ] };
  loader = new exports.ClientModuleSystem({ manifest, staticModules: {}, bootstrapModule: { id: 'boot', exports: {} }, registrationTarget: { mode: 'queue', pendingQueue: [] },
    loadBundle: async id => { started.push(id); if (id !== 'root') await new Promise(resolve => releases.set(id, resolve)); loader.register({ id, factory: () => ({ id }) }); },
  });
  const first = loader.prefetch('root'), second = loader.prefetch('root');
  await Promise.resolve(); assert.deepEqual(started.sort(), ['a', 'b']);
  releases.get('a')(); releases.get('b')(); await Promise.all([first, second]);
  assert.equal(started.filter(id => id === 'root').length, 1);
  assert.equal((await loader.import('root')).id, 'root');
  const cyclic = new exports.ClientModuleSystem({ manifest: { rev: 'c', modules: [{ id: 'c', url: 'c', external: ['c'] }] }, staticModules: {}, bootstrapModule: { id: 'boot', exports: {} }, registrationTarget: { mode: 'queue', pendingQueue: [] }, loadBundle: async () => {} });
  await assert.rejects(cyclic.prefetch('c'), /cycle/);
});
