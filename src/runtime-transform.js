// Narrow compatibility adapter: reject upstream drift, never overwrite installed DSH files.
function replaceOnce(source, from, to) {
  if (source.split(from).length !== 2) throw new Error('Unsupported DSH runtime anchor: ' + from.slice(0, 70));
  return source.replace(from, to);
}
export function transformRuntime(source) {
  if (!source.includes('exports.SessionRuntime = SessionRuntime;')) throw new Error('Unsupported DSH runtime');
  source = replaceOnce(source, 'var module = { exports: {} };', `var module = { exports: {} };
    async function performanceRead(method, payload, signal) {
      const response = await fetch('/session-performance/' + method, { method: 'POST', credentials: 'same-origin', signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method, payload }) });
      if (!response.ok) throw new Error('Session read failed: HTTP ' + response.status);
      return response.json();
    }`);
  source = replaceOnce(source, 'let { result } = await this.history({ maxMessages: 50 });', 'let { result } = await this.history({ maxMessages: 50 });');
  source = replaceOnce(source, 'history(payload) {\n\t\t\t\treturn this.address === void 0 ? this.api.sessions.history({', 'history(payload) {\n\t\t\t\treturn this.address === void 0 ? performanceRead("history", { diagnostics: this.diagnosticsLoaded === true,');
  // The subagent gateway remains native: it has a separate parent-derived authority boundary.
  source = replaceOnce(source, 'async resync() {', `async loadDiagnostics() {
        if (this.diagnosticsPromise) return this.diagnosticsPromise;
        if (this.diagnosticsLoaded) return Promise.resolve();
        const generation = this.openGeneration;
        this.diagnosticsPromise = (async () => {
          await this.open();
          if (generation !== this.openGeneration) throw new Error('Connection changed; retry diagnostics');
          this.diagnosticsLoaded = true;
          try {
            const { result } = await this.history({ maxMessages: 50 });
            if (!result.ok) throw new Error(result.error.message);
            const startSeq = this.baseSeq;
            let entries = result.value.events, hasMore = result.value.hasMore;
            for (let page = 0; hasMore && entries.length && entries[0].event.seq > startSeq; page++) {
              if (page >= 100) throw new Error('Diagnostic window is too large; reopen a smaller history window');
              const previous = await this.history({ beforeSeq: entries[0].event.seq, maxMessages: 50 });
              if (!previous.result.ok) throw new Error(previous.result.error.message);
              if (!previous.result.value.events.length) break;
              entries = [...previous.result.value.events, ...entries]; hasMore = previous.result.value.hasMore;
            }
            result.value = { ...result.value, events: entries, hasMore };
            if (generation !== this.openGeneration) throw new Error('Connection changed; retry diagnostics');
            // Preserve live arrivals while replacing the same tail window with full evidence.
            const tail = result.value.events.at(-1)?.event.seq ?? -1;
            const newer = this.events.flatMap((event, i) => event.seq > tail ? [{ event, view: this.views[i] }] : []);
            this.installWindow([...result.value.events, ...newer], result.value.hasMore, result.value.projections);
          } catch (error) { this.diagnosticsLoaded = false; throw error; }
        })().finally(() => { this.diagnosticsPromise = null; });
        return this.diagnosticsPromise;
      }
      async resync() {`);
  source = replaceOnce(source, 'const { result } = await this.api.sessions.list({});', `const { result } = await performanceRead('list', { includeIds: [...new Set([this.selected, new URL(location.href).searchParams.get('session')].filter(Boolean))], retainIds: established.map(row => row.sessionId).slice(0, 2000) });
          if (result.ok && this.nextCursor === undefined) this.nextCursor = result.value.nextCursor;`);
  source = replaceOnce(source, 'return (await this.api.sessions.search({ query }, signal)).result;', `const result = (await this.api.sessions.search({ query }, signal)).result;
          if (result.ok) await this.ensureListed(result.value.items.map(item => item.sessionId));
          return result;`);
  source = replaceOnce(source, 'buildListSnapshot() {', `async ensureListed(ids) {
        const missing = ids.filter(id => !this.summaries.some(row => row.sessionId === id));
        if (!missing.length) return;
        const { result } = await performanceRead('list', { limit: 1, includeIds: missing.slice(0, 40) });
        if (!result.ok) throw new Error(result.error.message);
        for (const summary of result.value.items) this.recordMutation({ kind: 'upsert', summary });
      }
      async loadMore() {
        if (this.morePending || !this.nextCursor) return this.morePending;
        this.moreLoading = true; this.moreError = null; this.notifier.markDirty();
        const cursor = this.nextCursor;
        this.morePending = (async () => {
          const { result } = await performanceRead('list', { cursor });
          if (!result.ok) throw new Error(result.error.message);
          for (const summary of result.value.items) this.recordMutation({ kind: 'upsert', summary });
          this.nextCursor = result.value.nextCursor;
        })().catch(error => { this.moreError = error.message; }).finally(() => { this.moreLoading = false; this.morePending = null; this.notifier.markDirty(); });
        return this.morePending;
      }
      buildListSnapshot() {`);
  source = replaceOnce(source, 'items: this.itemsCache,\n\t\t\t\t\tcurrent,', 'items: this.itemsCache,\n\t\t\t\t\tnextCursor: this.nextCursor, moreLoading: this.moreLoading, moreError: this.moreError,\n\t\t\t\t\tcurrent,');
  source = replaceOnce(source, 'const { items, current, phase, subagentsByParent, jobsBySession, currentAddress } = this.manager.getListSnapshot();', 'const { items, current, phase, subagentsByParent, jobsBySession, currentAddress, nextCursor, moreLoading, moreError } = this.manager.getListSnapshot();');
  source = replaceOnce(source, 'this.list.set({\n\t\t\t\t\tids,', 'this.list.set({\n\t\t\t\t\tnextCursor, moreLoading, moreError,\n\t\t\t\t\tids,');
  source = replaceOnce(source, 'open(id) {\n\t\t\t\tthis.manager.select(id);', `open(id) {
        if (!this.manager.summaries.some(row => row.sessionId === id)) {
          return this.manager.ensureListed([id]).then(() => { this.projectList(); this.manager.select(id); }).catch(error => { console.error('Could not open session:', error); });
        }
        this.manager.select(id);`);
  source = replaceOnce(source, 'refresh() {\n\t\t\t\treturn this.manager.refreshList();', 'loadMore() { return this.manager.loadMore(); }\n\t\t\trefresh() {\n\t\t\t\treturn this.manager.refreshList();');
  source = replaceOnce(source, 'return this.manager.search(query, signal);', 'return this.manager.search(query, signal).then(result => { this.projectList(); return result; });');
  return source.replace(/\n\/\/# sourceMappingURL=.*$/, '');
}
