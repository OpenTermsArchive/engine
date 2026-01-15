import { once } from 'node:events';

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
  }

  async log(info, callback) {
    try {
      await async.retry(RETRY_OPTIONS, async () => {
        const result = Promise.race([
          once(this.mailTransport, 'logged'),
          once(this.mailTransport, 'error').then(([err]) => { throw err; }),
        ]);

        this.mailTransport.log(info, () => {});

        return result;
      });
    } catch (error) {
      console.warn(`SMTP mail sending failed after ${RETRY_OPTIONS.times} attempts: ${error.message}`);
      this.emit('error', error);
    }
    callback();
  }
}

export default MailTransportWithRetry;
