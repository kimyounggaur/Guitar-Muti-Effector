// Counts React component renders per component name through the DevTools global hook.
// Installed before the app loads (no app code changes). Use the dev server so component names are not minified.
export const renderCounterInitScript = () => {
  const counts: Record<string, number> = {};
  let enabled = false;
  const nameOf = (type: unknown): string | null => {
    if (typeof type === 'function') return (type as { displayName?: string; name?: string }).displayName || (type as { name: string }).name || null;
    if (type && typeof type === 'object' && 'render' in (type as object)) return nameOf((type as { render: unknown }).render);
    if (type && typeof type === 'object' && 'type' in (type as object)) return nameOf((type as { type: unknown }).type);
    return null;
  };
  type Fiber = { child: Fiber | null; sibling: Fiber | null; type: unknown; flags: number; alternate: Fiber | null; tag: number; memoizedProps: unknown; memoizedState: unknown };
  // A component rendered in this commit when its props or state object differs from the last commit we saw.
  // (Bailed-out subtrees keep stale fibers, so flags alone over-count.)
  const lastSeen = new WeakMap<object, { props: unknown; state: unknown }>();
  const walk = (fiber: Fiber | null) => {
    for (let node = fiber; node; node = node.sibling) {
      if (node.tag === 0 || node.tag === 11 || node.tag === 14 || node.tag === 15) {
        const previous = lastSeen.get(node) ?? (node.alternate ? lastSeen.get(node.alternate) : undefined);
        const rendered = !previous || previous.props !== node.memoizedProps || previous.state !== node.memoizedState;
        const record = { props: node.memoizedProps, state: node.memoizedState };
        lastSeen.set(node, record);
        if (node.alternate) lastSeen.set(node.alternate, record);
        const name = nameOf(node.type);
        if (enabled && rendered && name) counts[name] = (counts[name] ?? 0) + 1;
      }
      walk(node.child);
    }
  };
  (window as unknown as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject(renderer: unknown) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; },
    onCommitFiberRoot(_id: number, root: { current: Fiber }) { walk(root.current.child); },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  };
  (window as unknown as Record<string, unknown>).__renderCounter = {
    start() { for (const key of Object.keys(counts)) delete counts[key]; enabled = true; },
    stop() { enabled = false; return { ...counts }; },
  };
};
