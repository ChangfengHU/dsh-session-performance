# Acceptance: Session Summary Payload

Verified on Linux 114 on 2026-11-10 against its existing DSH 0.1.1-rc.2 Web profile. No new model requests were sent.

## Measured Results

- Same 13 sessions before and after.
- Native list value, decoded: 1504294 bytes before; 4298 bytes after (about 99.7% smaller).
- Compressed public list response: about 357-360 KB before; 1065-1069 bytes after.
- Public cold-connection sample: 3.54 seconds before; 2.30 seconds after. These are separate samples, not a controlled browser benchmark.
- Public reused-connection samples: 0.60-1.04 seconds before; 0.39-0.41 seconds after.
- Native summary/navigation hash matched the expected compact baseline exactly.
- Selected-session history hash remained identical; all 255 events and complete Context projections were retained.
- Native history pagination: maxMessages=2 returned 41 events with hasMore=true; beforeSeq=214 returned the prior 44-event page ending at seq=213.
- Real browser verified the original deep link, titles, workspace grouping and full Context view (four turns, four steps, system prompt and 34 tool schemas).

## Tests And Boundaries

Six automated tests cover metadata fidelity, optional projections, error and RPC preservation, 1000 summaries, untouched native history, caller context and disposal.

This change is a reversible host response boundary. It adds no frontend bundle, server, database, credentials, model changes, session writes or native framework source patches.

## Not Yet Implemented

The native session.list contract still returns all lightweight summaries. This release does not implement a server cursor or claim that the sidebar's existing Show More button is server pagination.

Selected-session Context details still arrive with native history; fetching individual diagnostic panels separately remains future work. Native message-history pagination is already present and remains intact.

Remaining public connection latency is not removed by making the JSON smaller. No Core Web Vitals or exact end-user page-load-speed claim is made.
