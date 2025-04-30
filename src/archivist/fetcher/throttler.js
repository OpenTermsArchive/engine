import { URL } from 'url';

class Throttler {
  constructor(minIntervalMs = 10000) { // 10 seconds default
    this.minIntervalMs = minIntervalMs;
    this.lastRequestTime = new Map();
  }

  async waitForDomain(url) {
    const domain = new URL(url).hostname;
    const now = Date.now();
    const lastRequest = this.lastRequestTime.get(domain) || 0;
    const timeToWait = Math.max(0, lastRequest + this.minIntervalMs - now);

    if (timeToWait > 0) {
      await new Promise(resolve => {
        setTimeout(resolve, timeToWait);
      });
    }

    this.lastRequestTime.set(domain, Date.now());
  }
}

// Export a singleton instance
export default new Throttler();
