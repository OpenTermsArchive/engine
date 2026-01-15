import winston from 'winston';
import 'winston-mail';

const RETRY_DELAYS_MS = [ 5000, 20000, 60000 ];

/**
 * Custom Winston transport that wraps the Mail transport with retry logic.
 * When sending fails (e.g., SMTP timeout), it retries with increasing delays defined in RETRY_DELAYS_MS before giving up.
 */
class MailTransportWithRetry extends winston.Transport {
  constructor(options) {
    super(options);
    this.mailTransport = new winston.transports.Mail(options);
  }

  async log(info, callback) {
    let lastError;
    const maxAttempts = RETRY_DELAYS_MS.length + 1; // 4 attempts: initial + 3 retries

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await new Promise((resolve, reject) => { // Convert the event-based Mail transport into a Promise
          const errorHandler = err => {
            this.mailTransport.removeListener('logged', loggedHandler); // The Mail transport emits 'logged' on success
            reject(err);
          };

          const loggedHandler = () => {
            this.mailTransport.removeListener('error', errorHandler);
            resolve();
          };

          // Listen for success or failure events (once to avoid memory leaks)
          this.mailTransport.once('error', errorHandler);
          this.mailTransport.once('logged', loggedHandler);

          this.mailTransport.log(info, () => {}); // Trigger the actual email sending
        });

        callback(); // Email sent successfully, notify Winston and exit

        return;
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === maxAttempts - 1;

        // Using console.warn to avoid infinite loop (logging via mail transport would trigger another mail)
        if (isLastAttempt) {
          console.warn(`SMTP mail sending failed (attempt ${attempt + 1}/${maxAttempts}): ${error.message}; no more retries`);
        } else {
          const delaySeconds = RETRY_DELAYS_MS[attempt] / 1000;

          console.warn(`SMTP mail sending failed (attempt ${attempt + 1}/${maxAttempts}): ${error.message}; retrying in ${delaySeconds}s…`);
          await sleep(RETRY_DELAYS_MS[attempt]);
        }
      }
    }

    this.emit('error', lastError); // All attempts failed, emit error for the logger's error handler
    callback();
  }
}

const sleep = ms => new Promise(resolve => {
  setTimeout(resolve, ms);
});

export default MailTransportWithRetry;
