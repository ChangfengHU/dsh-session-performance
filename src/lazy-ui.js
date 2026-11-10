export const DEFERRED_UI = {
  '@deepseek-ai/dsh-client-ui-trajectory': [{ name: 'conversation.view', id: 'trajectory', label: 'Trajectory', order: 10, diagnostics: true }],
  'dsh-context': [{ name: 'conversation.view', id: 'context', label: 'Context', order: 20, diagnostics: true }],
  'dsh-plugin-station': [
    { name: 'settings.plugins.tab', id: 'plugin-station-market', label: 'Market', order: 31 },
    { name: 'settings.plugins.tab', id: 'plugin-station-code-plugins', label: 'Code plugins', order: 30 },
    { name: 'workbench.page', id: 'plugin-station', label: 'Plugin Station', order: 40 },
  ],
  'dsh-skill-mcp-console': [
    { name: 'settings.section', id: 'skill-mcp-apps', label: 'Apps', order: 25 },
    { name: 'settings.section', id: 'skill-mcp-skills', label: 'Skills', order: 26 },
    { name: 'settings.section', id: 'skill-mcp-mcp', label: 'MCP', order: 27 },
    { name: 'workbench.page', id: 'skills-mcp', label: 'Skills & MCP', order: 20 },
  ],
};

export function lazySource(id, url, dependencies, descriptors = DEFERRED_UI[id]) {
  return `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: require => {
    const React = require('react'), h = React.createElement;
    return { inject: ['slots', 'sessions', 'modules'], apply(ctx) {
      const rows = ${JSON.stringify(descriptors)}, stops = []; let pending, actual, lastError = '';
      function register() {
        for (const row of rows) stops.push(ctx.slots.inject(row.name, () => ctx.slots.register({ ...row, label: row.name === 'workbench.page' ? row.label : () => row.label, diagnostics: undefined }, Loading)));
      }
      async function activate(sessionId) {
        if (rows.some(row => row.diagnostics) && sessionId) await ctx.sessions.binding(sessionId)?.session.loadDiagnostics();
        if (pending) return pending;
        pending = (async () => {
          if (!actual) {
          await Promise.all(${JSON.stringify(dependencies)}.map(id => ctx.modules.import(id)));
          await new Promise((resolve, reject) => {
            const script = document.createElement('script'); script.src = ${JSON.stringify(url)}; script.async = true;
            script.onload = () => { script.remove(); resolve(); }; script.onerror = () => { script.remove(); reject(new Error('Could not load this panel. Retry, or refresh after an update.')); }; document.head.append(script);
          });
          actual = await ctx.modules.import(${JSON.stringify(id + '~deferred')});
          }
          while (stops.length) await stops.pop()();
          const fiber = ctx.plugin(actual);
          await fiber.inertia;
          if (fiber.state !== 2) { await fiber.dispose(); throw new Error('Panel activation failed. Retry.'); }
        })().catch(error => { pending = undefined; lastError = error.message; if (!stops.length) register(); throw error; });
        return pending;
      }
      function Loading(props) {
        const [error, setError] = React.useState(lastError), [attempt, retry] = React.useState(0);
        React.useEffect(() => { let live = true; if (lastError && !attempt) return; lastError = ''; setError(''); activate(props.sessionId).catch(error => { if (live) setError(error.message); }); return () => { live = false; }; }, [props.sessionId, attempt]);
        return h('div', { style: { padding: 24, fontSize: 14 }, role: error ? 'alert' : 'status' }, error || 'Loading panel…', error ? h(React.Fragment, null, h('button', { type: 'button', onClick: () => retry(attempt + 1), style: { marginLeft: 12 } }, 'Retry'), h('button', { type: 'button', onClick: () => location.reload(), style: { marginLeft: 8 } }, 'Refresh page')) : null);
      }
      register();
      if (${JSON.stringify(id)} === 'dsh-context') {
        const triggers = ctx.get('inputTriggers');
        if (triggers) stops.push(triggers.registerSource({ trigger: '/', name: 'context', order: 1,
          candidates: (_session, req) => Promise.resolve(req.position === 'leading' && (!req.query.trim() || 'context'.startsWith(req.query.trim().toLowerCase())) ? [{ name: 'context', description: 'Inspect current context' }] : []),
          onPick: pick => { activate(pick.session.sessionId).then(() => actual.openDeferredContext(pick.session.sessionId, { kind: 'span', span: pick.span })).catch(error => console.warn(error.message)); return 'handled'; },
          matchEnter: (session, line) => { if (line !== '/context') return Promise.resolve(undefined); activate(session.sessionId).then(() => actual.openDeferredContext(session.sessionId, { kind: 'bare-token', token: '/context' })).catch(error => console.warn(error.message)); return Promise.resolve('handled'); },
        }));
      }
    } };
  }});`;
}

export function aliasBundle(source, id) {
  if (DEFERRED_UI[id]?.some(row => row.diagnostics)) {
    if (!source.includes('ctx.slots.register(') || !source.includes('var module = { exports: {} };')) throw new Error('Unsupported diagnostic UI: ' + id);
    source = source.replaceAll('ctx.slots.register(', 'diagnosticRegister(ctx, ').replace('var module = { exports: {} };', `var module = { exports: {} };
      function diagnosticRegister(ctx, options, Component) {
        const overlay = options.name === 'conversation.input.overlay' && options.id === 'context-modal';
        if (options.name !== 'conversation.view' && !overlay) return ctx.slots.register(options, Component);
        const React = require('react');
        function Gate(props) {
          const [ready, setReady] = React.useState(false), [error, setError] = React.useState(''), [attempt, retry] = React.useState(0);
          const open = overlay ? props.useContextModal(state => state) : true;
          React.useEffect(() => { let live = true; if (!open) return; setReady(false); setError('');
            const session = ctx.sessions.binding(props.sessionId)?.session;
            Promise.resolve().then(() => { if (!session) throw new Error('Session unavailable'); return session.loadDiagnostics(); }).then(() => { if (live) setReady(true); }, error => { if (live) setError(error.message); });
            return () => { live = false; };
          }, [props.sessionId, attempt, open]);
          if (!open) return null;
          return ready ? React.createElement(Component, props) : React.createElement('div', { role: error ? 'alert' : 'status', style: { padding: 24 } }, error || 'Loading complete diagnostics…', error ? React.createElement('button', { onClick: () => retry(attempt + 1) }, 'Retry') : null);
        }
        return ctx.slots.register(options, Gate);
      }`);
  }
  if (id === 'dsh-context') {
    source = source.replace('return module.exports;\n\t}', `module.exports.openDeferredContext = (sessionId, guard) => { setPendingConsume(sessionId, guard); modalStoreOf(sessionId).set(true); };\nreturn module.exports;\n\t}`);
  }
  const pattern = new RegExp('(\\bid\\s*:\\s*)(["\\\'])' + id.replace(/[.*+?^\$()|[\]\\]/g, '\\$&') + '\\2');
  if (!pattern.test(source.slice(0, 400))) throw new Error('Unsupported lazy bundle: ' + id);
  return source.replace(pattern, (_, prefix) => prefix + JSON.stringify(id + '~deferred'));
}

export function rewriteBoot(html, replacements) {
  return html.replace(/globalThis\["__DSH_BOOT__"\] = (\{[^\n]*\});?(?=<\/script>)/, (whole, json) => {
    const boot = JSON.parse(json);
    boot.entries = boot.entries.map(row => replacements.has(row.id) ? { ...row, url: replacements.get(row.id).url, rev: replacements.get(row.id).rev, ...(DEFERRED_UI[row.id] ? { external: [] } : {}) } : row);
    return 'globalThis["__DSH_BOOT__"] = ' + JSON.stringify(boot) + ';';
  }).replace(/<link\b[^>]*rel="preload"[^>]*>/g, tag => {
    for (const id of Object.keys(DEFERRED_UI)) if (tag.includes('/plugins/' + id + '/client.js')) return '';
    return tag;
  }).replace(/(<script[^>]*src=")([^"<>]+)(")/g, (tag, before, url, after) => {
    for (const [id, row] of replacements) if (url.startsWith('/plugins/' + id + '/client.js?')) return before + row.url + after;
    return tag;
  }).replace(/(<link[^>]*href=")([^"<>]+)(")/g, (tag, before, url, after) => {
    for (const [id, row] of replacements) if (url.startsWith('/plugins/' + id + '/client.js?')) return before + row.url + after;
    return tag;
  });
}
