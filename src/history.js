const clone = value => structuredClone(value);

export function createHistory(initial) {
  return { past: [], present: clone(initial), future: [] };
}

export function commitHistory(history, next) {
  return { past: [...history.past, clone(history.present)], present: clone(next), future: [] };
}

export function undoHistory(history) {
  if (!history.past.length) return history;
  const past = history.past.slice();
  const present = past.pop();
  return { past, present, future: [clone(history.present), ...history.future] };
}

export function redoHistory(history) {
  if (!history.future.length) return history;
  const [present, ...future] = history.future;
  return { past: [...history.past, clone(history.present)], present, future };
}
