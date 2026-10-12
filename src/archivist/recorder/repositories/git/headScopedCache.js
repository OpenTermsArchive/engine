const DEFAULT_MAX_ENTRIES = 500;

export default class HeadScopedCache { // A commit SHA pins the whole history reachable from it, so a result read at a given HEAD stays valid for as long as HEAD does not move
  #entries = new Map();

  constructor({ maxEntries = DEFAULT_MAX_ENTRIES } = {}) {
    this.maxEntries = maxEntries; // Bounds the memory held for collections with many services
  }

  get(key, head, compute) {
    const previous = this.#entries.get(key);

    if (previous?.head === head) {
      return previous.promise;
    }

    const entry = { head, promise: new Promise(resolve => { resolve(compute(previous)); }) };

    this.#entries.delete(key);
    this.#entries.set(key, entry); // Stored before it settles, so that simultaneous calls share a single computation

    if (this.#entries.size > this.maxEntries) {
      this.#entries.delete(this.#entries.keys().next().value);
    }

    entry.promise.catch(() => {
      if (this.#entries.get(key) === entry) { // A newer computation may have replaced this one meanwhile, and must be kept
        this.#entries.delete(key);
      }
    });

    return entry.promise;
  }
}
