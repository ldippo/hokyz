type Handler<T> = (payload: T) => void;

export class Emitter<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Handler<Events[K]>[] } = {};
  on<K extends keyof Events>(key: K, fn: Handler<Events[K]>): () => void {
    (this.handlers[key] ??= []).push(fn);
    return () => this.off(key, fn);
  }
  off<K extends keyof Events>(key: K, fn: Handler<Events[K]>): void {
    const list = this.handlers[key];
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }
  emit<K extends keyof Events>(key: K, payload: Events[K]): void {
    this.handlers[key]?.slice().forEach((h) => h(payload));
  }
}
