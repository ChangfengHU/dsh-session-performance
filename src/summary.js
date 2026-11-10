const LIST_PROJECTIONS = new Set(['title', 'sessionListMetadata', 'subagent']);

export function compactSummary(summary) {
  if (!summary?.projections) return summary;
  const { projections, ...row } = summary;
  const values = Object.fromEntries(Object.entries(projections.values ?? {}).filter(([key]) => LIST_PROJECTIONS.has(key)));
  return Object.keys(values).length ? { ...row, projections: { asOfSeq: projections.asOfSeq, values } } : row;
}

export function compactListResponse(response) {
  if (!response?.result?.ok || !Array.isArray(response.result.value?.items)) return response;
  return { ...response, result: { ...response.result, value: { ...response.result.value, items: response.result.value.items.map(compactSummary) } } };
}

export function installSummaryBoundary(api) {
  const owner = api.sessions;
  const original = owner.list;
  const wrapped = async function (...args) { return compactListResponse(await original.apply(this, args)); };
  owner.list = wrapped;
  return () => { if (owner.list === wrapped) owner.list = original; };
}

