# DSH Session Performance

A reversible Web-profile plugin for DeepSeek Harness. Chat starts with small session summaries and a lightweight history projection. Diagnostic and administration interfaces load when opened.

## Capabilities

- Session sidebar: real server cursors, 30 rows per page, stable timestamp/ID ordering and a Load older sessions action. Search and old deep links hydrate visible summaries and their parents. Reconnect retains already loaded rows while rechecking native visibility.
- Chat history: retains every event sequence, tool result and approval event, but defers request-header prompt/tool payloads and Context projections. It does not rewrite the canonical session log.
- Context and Trajectory: first opening fetches complete evidence through the native history gateway, then loads the full interface. Each newly opened session is hydrated independently. Native Trace retains its own existing on-demand data path.
- Context, Trajectory, Plugin Station and Skills/MCP interfaces use small placeholder registrations at startup. Their actual classic-CJS bundles load once through the existing module system and activate in a native Cordis fiber. Failed loads have an explicit Retry action.
- The existing /context command remains available before the Context interface has loaded.

## Installation And Compatibility

Install into an existing DSH Web profile with its normal plugin installer and restart while no turn is active. Tested against DSH 0.1.1-rc.2. No additional server, database, container or worktree is needed.

The plugin uses the public clientModules clientPath/graph, webServer tapIndex/route and trusted Connection RPC interfaces. A narrow, anchor-validated compatibility adapter extends the served runtime bundle with paged reads and explicit diagnostics hydration. Installed native files are never overwritten. Unsupported upstream bundle shapes fail explicitly rather than silently applying a partial transformation; validate upgrades before deploying them.

The native visibility inventory is still authoritative. Pagination slices its lightweight summaries; this is not a replacement database index or a new session persistence backend. Concurrent list reads share their in-flight inventory read, without caching stale running/authorization state.

Uninstalling the plugin restores native boot URLs and native reads. Canonical history, Context content, prompts, model credentials, main-model selection, filesystem permissions and approvals remain unchanged.

## Development

Run `npm test` and `npm run check`. Set `DSH_INSTALL_ROOT` to the installed DSH package root to run the actual-runtime adapter integration test as well. Tests cover 1000 rows, cursor ties, insertion, direct-link lineage, search, reconnect, visibility errors, event fidelity, lazy-load deduplication and awaited lifecycle disposal.

All source edits, tests, builds and Git operations for this deployment are performed on Linux. This package contains no host addresses, keys or business session data.

## Related Optimization

`dsh-claude-translate` 0.3.4 returns at most eight recent cached display bodies within a 64 KiB budget alongside changed Chat metadata. Larger and older bodies retain lazy batch loading. `dsh-plugin-station` 1.3.5 excludes the four deferred interfaces from preloading and prioritizes Chat-critical modules. Other small modules still required by the native boot barrier are preloaded in parallel; the native loader adapter also resolves independent dependency arrivals concurrently.

See ACCEPTANCE.md for measurements and verification scope. Network/tunnel latency and actual model inference time are separate from page-loading performance.
