import async from 'async';
import winston from 'winston';

import 'winston-mail';

export const RETRY_DELAYS = [ 5000, 20000, 60000 ];

const RETRY_OPTIONS = {
  times: RETRY_DELAYS.length + 1,
  interval: retryCount => RETRY_DELAYS[retryCount - 1] || RETRY_DELAYS.at(-1),
  errorFilter: error => {
    console.warn(`SMTP mail sending failed: ${error.message}; retrying…`);

    return true;
  },
};

class MailTransportWithRetry extends winston.Transport {
  constructor(options) {
    super(options);
    this.mailTransport = new winston.transports.Mail(options);
    this.pending = new Set();
  }

  log(info, callback) {
    callback(); // Winston delivers each log to every transport in sequence, so waiting for the SMTP retries here would hold back the other transports too

    const sending = this.send(info).finally(() => this.pending.delete(sending));

    this.pending.add(sending);

    return sending;
  }

  async send(info) {
    try {
      await async.retry(RETRY_OPTIONS, async () => { await this.attempt(info); }); // The task must be an async function for async.retry to await it rather than wait for a callback
    } catch (error) {
      console.warn(`SMTP mail sending failed after ${RETRY_OPTIONS.times} attempts; giving up on this email:\n${error.stack}`);
    }
  }

  attempt(info) {
    return new Promise((resolve, reject) => {
      const removeListeners = () => {
        this.mailTransport.off('logged', onLogged);
        this.mailTransport.off('error', onError);
      };

      function onLogged() {
        removeListeners();
        resolve();
      }

      function onError(error) {
        removeListeners();
        reject(error);
      }

      this.mailTransport.once('logged', onLogged);
      this.mailTransport.once('error', onError);
      this.mailTransport.log(info, () => {});
    });
  }

  async flush() {
    await Promise.allSettled(this.pending);
  }
}

export default MailTransportWithRetry;
