import { createHash } from 'node:crypto';
import { compactSummary } from './summary.js';

const order = (a, b) => b.updatedAt - a.updatedAt || b.sessionId.localeCompare(a.sessionId);
const cursorOf = row => Buffer.from(JSON.stringify([row.updatedAt, row.sessionId])).toString('base64url');
export function pageSummaries(rows, { cursor, limit = 30, includeIds = [], retainIds = [] } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Array.isArray(includeIds) || includeIds.length > 40 || includeIds.some(id => typeof id !== 'string' || id.length > 200)) throw new Error('Invalid list request');
  if (!Array.isArray(retainIds) || retainIds.length > 2000 || retainIds.some(id => typeof id !== 'string' || id.length > 200)) throw new Error('Invalid retained IDs');
  const sorted = [...rows].sort(order);
  let after;
  if (cursor) {
    if (typeof cursor !== 'string' || cursor.length > 600) throw new Error('Invalid cursor');
    after = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (!Array.isArray(after) || after.length !== 2 || !Number.isFinite(after[0]) || typeof after[1] !== 'string') throw new Error('Invalid cursor');
  }
  const eligible = after ? sorted.filter(row => order(row, { updatedAt: after[0], sessionId: after[1] }) > 0) : sorted;
  const page = eligible.slice(0, limit);
  const included = new Map(page.map(row => [row.sessionId, row]));
  const byId = new Map(sorted.map(row => [row.sessionId, row]));
  // Retain direct links and their lineage, but only from the gateway's visible rows.
  for (const id of [...includeIds, ...retainIds]) {
    let row = byId.get(id), depth = 0;
    while (row && depth++ < 32 && !included.has(row.sessionId)) {
      included.set(row.sessionId, row); row = byId.get(row.parentSessionId);
    }
  }
  return { items: [...included.values()].sort(order).map(compactSummary), nextCursor: eligible.length > limit ? cursorOf(page.at(-1)) : null, hasMore: eligible.length > limit };
}

export function chatHistory(value) {
  if (!Array.isArray(value?.events)) return value;
  const projections = value.projections && { ...value.projections, values: Object.fromEntries(Object.entries(value.projections.values ?? {}).filter(([key]) => !/^context(?:Headers|Timeline|Breakdown|Pressure)$/.test(key))) };
  return { ...value, ...(projections ? { projections } : {}), diagnosticsDeferred: true,
    events: value.events.map(row => row.event.type !== 'request/header' ? row : {
      ...row, event: { ...row.event, data: { ...row.event.data, header: {
        ...row.event.data.header, system: undefined, messages: undefined, tools: undefined,
      } } },
    }),
  };
}

export function createReads(api) {
  let pending;
  async function summaries() {
    if (pending) return pending;
    pending = api.sessions.list({ type: 'client-request', rpcId: crypto.randomUUID(), method: 'session.list', payload: {} }).then(response => {
      if (!response.result.ok) throw new Error(response.result.error.message);
      return response.result.value.items;
    }).finally(() => { pending = undefined; });
    return pending;
  }
  return async (method, payload, signal) => {
    try {
      if (signal?.aborted) throw new Error('Read cancelled');
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid request');
      if (method === 'list') return { ok: true, value: pageSummaries(await summaries(), payload) };
      if (method !== 'history') return { ok: false, error: { code: 'not-found', message: 'Unknown read endpoint', details: {} } };
      if (typeof payload.sessionId !== 'string' || payload.sessionId.length > 200 || payload.maxMessages !== undefined && (!Number.isInteger(payload.maxMessages) || payload.maxMessages < 1 || payload.maxMessages > 100) || payload.beforeSeq !== undefined && (!Number.isInteger(payload.beforeSeq) || payload.beforeSeq < 0)) throw new Error('Invalid history request');
      const response = await api.sessions.history({ type: 'client-request', rpcId: crypto.randomUUID(), method: 'session.history', payload: { sessionId: payload.sessionId, maxMessages: payload.maxMessages ?? 50, ...(payload.beforeSeq === undefined ? {} : { beforeSeq: payload.beforeSeq }) } }, signal);
      if (!response.result.ok) return response.result;
      return { ok: true, value: payload.diagnostics === true ? response.result.value : chatHistory(response.result.value) };
    } catch (error) { return { ok: false, error: { code: 'bad-request', message: error.message, details: {} } }; }
  };
}

export const revision = text => createHash('sha256').update(text).digest('hex').slice(0, 12);
