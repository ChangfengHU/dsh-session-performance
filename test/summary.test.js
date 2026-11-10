import test from 'node:test';
import assert from 'node:assert/strict';
import { compactSummary, compactListResponse, installSummaryBoundary } from '../src/summary.js';

const row = (id = 's1') => ({ sessionId: id, updatedAt: 42, running: false, blank: false, cwd: '/project', agentPreset: 'standard', parentSessionId: 'parent', projections: { asOfSeq: 15, values: { title: 'Weekend trip', sessionListMetadata: { blank: false, lastPromptAt: 42 }, subagent: null, contextHeaders: { headers: [{ system: 'private context', tools: [{ schema: { text: 'x'.repeat(120000) } }] }] }, contextTimeline: { turns: [] }, contextPressure: { tokens: 42 } } } });
const response = items => ({ type: 'server-response', rpcId: 'request1', result: { ok: true, value: { items } } });

test('retains native navigation and title metadata without context payloads', () => {
  const original = row(), compact = compactSummary(original);
  for (const key of ['sessionId', 'updatedAt', 'running', 'blank', 'cwd', 'agentPreset', 'parentSessionId']) assert.equal(compact[key], original[key]);
  assert.deepEqual(Object.keys(compact.projections.values), ['title', 'sessionListMetadata', 'subagent']);
  assert.equal(compact.projections.asOfSeq, 15);
  assert.equal(original.projections.values.contextHeaders.headers[0].system, 'private context');
  assert.equal(JSON.stringify(compact).includes('private context'), false);
});

test('absent and irrelevant projection blocks remain optional', () => {
  const original = { sessionId: 's1' }; assert.equal(compactSummary(original), original);
  assert.deepEqual(compactSummary({ sessionId: 's2', projections: { asOfSeq: 5, values: { contextHeaders: {} } } }), { sessionId: 's2' });
});

test('does not mutate replies, errors, RPC identity, order or record count', () => {
  const error = { rpcId: 'r', result: { ok: false, error: { code: 'denied' } } }; assert.equal(compactListResponse(error), error);
  const before = response([row('b'), row('a')]), after = compactListResponse(before);
  assert.equal(after.rpcId, before.rpcId); assert.deepEqual(after.result.value.items.map(r => r.sessionId), ['b', 'a']);
  assert.ok(before.result.value.items[0].projections.values.contextHeaders);
});

test('one thousand summaries stay bounded and contain no request-header content', () => {
  const result = compactListResponse(response(Array.from({ length: 1000 }, (_, i) => row('s' + i))));
  const encoded = JSON.stringify(result);
  assert.equal(result.result.value.items.length, 1000); assert.ok(Buffer.byteLength(encoded) < 400000);
  assert.equal(encoded.includes('contextHeaders'), false);
});

test('native caller context, thrown errors and full history are preserved', async () => {
  const api = { sessions: { marker: 1, async list(request) { assert.equal(this.marker, 1); assert.equal(request.payload.value, 7); return response([row()]); }, async history() { return row().projections; } } };
  const history = api.sessions.history, stop = installSummaryBoundary(api);
  assert.ok(!(await api.sessions.list({ payload: { value: 7 } })).result.value.items[0].projections.values.contextHeaders);
  assert.equal(api.sessions.history, history); assert.ok((await api.sessions.history()).values.contextHeaders); stop();
  const failure = new Error('transport'); api.sessions.list = async () => { throw failure; }; const cleanup = installSummaryBoundary(api);
  await assert.rejects(api.sessions.list({}), e => e === failure); cleanup();
});

test('disposal restores its owner without overwriting a later registration', () => {
  const original = () => {}; const api = { sessions: { list: original } }; const stop = installSummaryBoundary(api); stop(); assert.equal(api.sessions.list, original); stop();
  const stop2 = installSummaryBoundary(api), replacement = () => {}; api.sessions.list = replacement; stop2(); assert.equal(api.sessions.list, replacement);
});

