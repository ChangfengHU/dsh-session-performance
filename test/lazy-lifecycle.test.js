import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { lazySource } from '../src/lazy-ui.js';

test('concurrent panel mounts fetch once and await disposal before native plugin activation', async () => {
  let plugin, Component, scriptCount = 0, disposing = false, activated = 0;
  const effects = [], failures = [];
  const React = { createElement: (...args) => args, useState: value => [value, () => {}], useEffect: effect => effects.push(effect) };
  const actual = { apply() {} };
  const ctx = {
    slots: { inject(_name, callback) { callback(); return async () => { disposing = true; await new Promise(resolve => setTimeout(resolve, 5)); disposing = false; }; }, register(_options, component) { Component = component; return () => {}; } },
    sessions: { binding: () => ({ session: { loadDiagnostics: async () => {} } }) },
    modules: { import: async () => actual },
    plugin(candidate) { assert.equal(candidate, actual); assert.equal(disposing, false); activated++; return { state: 2, inertia: Promise.resolve(), dispose: async () => {} }; },
    get() {},
  };
  const sandbox = { window: { __ModuleLoader__: { load(reg) { plugin = reg.factory(() => React); } } },
    document: { createElement: () => ({ remove() {} }), head: { append(script) { scriptCount++; queueMicrotask(() => script.onload()); } } },
    console: { warn: error => failures.push(error) },
  };
  new vm.Script(lazySource('dsh-context', '/full.js', [])).runInNewContext(sandbox);
  plugin.apply(ctx); Component({ sessionId: 's' }); Component({ sessionId: 's' });
  effects.forEach(effect => effect());
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(scriptCount, 1); assert.equal(activated, 1); assert.equal(failures.length, 0);
});
