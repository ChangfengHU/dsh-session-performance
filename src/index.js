import { installSummaryBoundary } from './summary.js';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createReads, revision } from './read-model.js';
import { transformRuntime } from './runtime-transform.js';
import { transformModules } from './modules-transform.js';
import { DEFERRED_UI, aliasBundle, lazySource, rewriteBoot } from './lazy-ui.js';

export const name = 'session-performance';
export const inject = ['apiProxy', 'connection', 'webServer', 'clientModules'];

export function apply(ctx) {
  ctx.effect(() => installSummaryBoundary(ctx.apiProxy), 'session-performance: compact list response');
  ctx.connection.rpc.handle('/session-performance', createReads(ctx.apiProxy), { authority: 'trusted-host' });
  const assets = new Map(), replacements = new Map(); let generation;
  function prepare() {
    const graph = ctx.clientModules.graph();
    if (generation === graph.rev) return;
    const nextAssets = new Map(), nextReplacements = new Map();
    for (const entry of graph.entries) {
      if (!['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-modules'].includes(entry.id) && !DEFERRED_UI[entry.id]) continue;
      const source = readFileSync(ctx.clientModules.clientPath(entry.id), 'utf8');
      let body;
      if (DEFERRED_UI[entry.id]) {
        const actual = aliasBundle(source, entry.id);
        const actualRev = revision(actual), actualUrl = '/session-performance/assets/' + actualRev + '-full.js';
        nextAssets.set(actualUrl, actual);
        const dependencies = [...new Set([...source.matchAll(/\brequire\(["']([^"']+)["']\)/g)].map(match => match[1]))].filter(id => id !== entry.id);
        body = lazySource(entry.id, actualUrl, dependencies);
      } else body = entry.id === '@deepseek-ai/dsh-client-modules' ? transformModules(source) : transformRuntime(source);
      const rev = revision(body), url = '/session-performance/assets/' + rev + '.js';
      nextAssets.set(url, body); nextReplacements.set(entry.id, { url, rev });
    }
    assets.clear(); replacements.clear();
    for (const [key, value] of nextAssets) assets.set(key, value);
    for (const [key, value] of nextReplacements) replacements.set(key, value);
    generation = graph.rev;
  }
  ctx.effect(() => ctx.webServer.register({ kind: 'prefix', path: '/session-performance/assets', handler(req, res) {
    prepare(); const url = new URL(req.url, 'http://internal'); const body = assets.get(url.pathname);
    if (!body || req.method !== 'GET') { res.writeHead(404); res.end(); return; }
    const compressed = /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
    const output = compressed ? gzipSync(body) : Buffer.from(body);
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', vary: 'Accept-Encoding', ...(compressed ? { 'content-encoding': 'gzip' } : {}), 'content-length': output.length }); res.end(output);
  } }), 'session-performance: bounded UI assets');
  ctx.effect(() => ctx.webServer.tapIndex(html => { prepare(); return rewriteBoot(html, replacements); }), 'session-performance: staged boot');
}
