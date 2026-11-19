import async from 'async';
import nodemailer from 'nodemailer';
import winston from 'winston';

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
  constructor({ smtp, from, to, subject, render, ...options }) {
    super(options);
    this.transporter = nodemailer.createTransport(smtp);
    this.from = from;
    this.to = to;
    this.subject = subject;
    this.render = render;
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
      await async.retry(RETRY_OPTIONS, async () => { await this.transporter.sendMail({ from: this.from, to: this.to, subject: this.subject, ...this.render(info) }); }); // The task must be an async function for async.retry to await it rather than wait for a callback
    } catch (error) {
      console.warn(`SMTP mail sending failed after ${RETRY_OPTIONS.times} attempts; giving up on this email:\n${error.stack}`);
    }
  }

  async flush() {
    await Promise.allSettled(this.pending);
  }
}

export default MailTransportWithRetry;
