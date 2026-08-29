/**
 * eventBus.js — one shared pub/sub channel.
 *
 * The views never call each other directly: a chart click publishes
 * 'phoneme:selected' and whoever cares (the visualiser, the readout, the
 * audio layer) reacts. That is what keeps new features additive.
 */

export class EventBus {
  constructor() { this.map = new Map(); }

  /** @returns {() => void} unsubscribe */
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }

  off(evt, fn) { this.map.get(evt)?.delete(fn); }

  emit(evt, payload) {
    const set = this.map.get(evt);
    if (!set) return;
    // Copy first: a handler may unsubscribe during dispatch.
    // Async handlers are common here (speech is awaited), and a rejected
    // promise would otherwise vanish without a trace — so catch both the
    // synchronous throw and the rejection.
    [...set].forEach((fn) => {
      try {
        const result = fn(payload);
        if (result && typeof result.catch === 'function') {
          result.catch((err) => console.error(`[bus] async handler for "${evt}" failed`, err));
        }
      } catch (err) {
        console.error(`[bus] handler for "${evt}" failed`, err);
      }
    });
  }
}

export const bus = new EventBus();
export default bus;
