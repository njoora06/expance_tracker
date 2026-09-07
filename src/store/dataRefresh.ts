type Listener = () => void;
let listeners: Listener[] = [];

export function onDataRefresh(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function triggerDataRefresh() {
  listeners.forEach((l) => l());
}
