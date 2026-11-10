window.__ModuleLoader__.load({ id: 'dsh-session-performance', factory: require => {
  const React = require('react'), h = React.createElement;
  function apply(ctx) {
    function More() {
      const state = React.useSyncExternalStore(fn => ctx.sessions.list.subscribe(fn), () => ctx.sessions.list.getSnapshot());
      if (!state.nextCursor && !state.moreError) return null;
      return h('div', { style: { padding: '6px 12px', fontSize: 12 } }, state.moreError ? h('div', { role: 'alert' }, state.moreError) : null,
        h('button', { type: 'button', disabled: state.moreLoading, onClick: () => ctx.sessions.loadMore(), style: { border: '1px solid #dfe2e8', borderRadius: 4, background: 'transparent', color: 'inherit', padding: '5px 10px', cursor: 'pointer' } }, state.moreLoading ? 'Loading sessions…' : state.moreError ? 'Retry loading sessions' : 'Load older sessions'));
    }
    ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: 'session-performance-more', order: -10 }, More));
  }
  return { inject: ['slots', 'sessions'], apply };
}});
