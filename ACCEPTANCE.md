# Acceptance: Staged Session Loading

Verified on Linux 114 on 2026-11-10 with its existing DSH 0.1.1-rc.2 Web profile. No new model requests were sent and no production history was rewritten.

## Preserved Baseline

- Native session list still contains every authorized summary, with navigation, workspace, lineage, running and blank metadata.
- Native session.history is untouched. A new Chat-only read projection defers heavy diagnostic content; a full diagnostic read exactly matches the original native history value.
- The selected reference session retains all 255 events. Its native event SHA-256 before and after deployment is identical: `59f50dbe25b04d54b1c2e127433017e43f9672dbf28e93d159d2297a51f70105`.
- Native message-history pagination and the separate parent-authorized subagent gateway remain intact.

## Results

- Original session-list optimization: 13 summary rows fell from 1,504,294 decoded bytes to 4,298, about 99.7% less. This historical measurement predates the cursor release.
- Reference Chat history projection: 53,927 decoded bytes versus 354,413 native-history bytes, with the same 255 event sequence positions. Full diagnostic reads remain available on demand.
- Four large interfaces are replaced with roughly 2.3-2.8 KB startup stubs, not eagerly downloaded full bundles. The four deferred interfaces are not preloaded; Chat-critical preload hints get high priority. Remaining native boot-barrier modules are fetched in parallel, not postponed into an extra request waterfall.
- Translation metadata returns four existing cached display bodies in the reference session, eliminating their second body-fetch request. No new translation calls are made by a cache read.

## Tests

- Performance plugin: 15 deterministic tests including a composed installed-runtime adapter test, 1000-session cursor coverage, search, old links, reconnect, errors, canonical event preservation and lazy lifecycle deduplication.
- Translation plugin: 83 tests, including bounded initial display bodies and 100-record retention.
- Plugin Station: 24 tests, including exclusion of deferred panels from startup preload hints.
- Browser checks: existing deep link, Chinese replies, actual English-input disclosure, Context system prompt and 34 tool schemas, Trajectory rows, MCP and installed-plugin panels. Administration and permission boundaries are not loosened.

## Browser Reload Samples

Two normal reload observations after parallel loading: tabs visible at 4.04 s / 3.24 s, history at 4.50 s / 3.96 s, Chinese at 4.50 s / 4.11 s. These include browser automation and public-network variability and are not a controlled before/after experiment. No console errors were observed in the final browser check. The existing /context command opened complete diagnostics without sending a model request; switching sessions loaded the other session's own Context projections.

## Interpretation

Browser reload observations include automation and network latency; they are not LCP/INP/Core Web Vitals measurements. TLS/tunnel variability and model inference are not removed by smaller page payloads. This release makes no claim to make actual Claude or translation-model inference faster.
