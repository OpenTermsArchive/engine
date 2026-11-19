import { once } from 'node:events';
import net from 'node:net';

import { expect } from 'chai';
import sinon from 'sinon';

import MailTransportWithRetry, { RETRY_DELAYS } from './mail-transport-with-retry.js';

const MESSAGE_OPTIONS = {
  from: 'noreply@example.com',
  to: 'test@example.com',
  subject: 'Test subject',
  render: ({ message }) => ({ text: message, html: `<p>${message}</p>` }),
};

describe('MailTransportWithRetry', () => {
  let transport;

  context('when sending', () => {
    let clock;
    let sendMail;
    let consoleWarnStub;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
      consoleWarnStub = sinon.stub(console, 'warn');
      transport = new MailTransportWithRetry({ ...MESSAGE_OPTIONS, smtp: { host: 'smtp.example.com' } });
      sendMail = sinon.stub(transport.transporter, 'sendMail');
    });

    afterEach(() => {
      sinon.restore();
      clock.restore();
      transport.transporter.close();
    });

    const failAllAttempts = async logPromise => {
      await clock.tickAsync(RETRY_DELAYS.reduce((total, delay) => total + delay));
      await logPromise;
    };

    describe('#flush', () => {
      it('resolves once pending emails are sent', async () => {
        let sent;
        let flushed = false;

        sendMail.returns(new Promise(resolve => { sent = resolve; }));
        transport.log({ message: 'test' }, () => {});

        const flushPromise = transport.flush().then(() => { flushed = true; });

        await clock.tickAsync(0);
        expect(flushed).to.be.false;

        sent();
        await flushPromise;

        expect(flushed).to.be.true;
        expect(transport.pending).to.be.empty;
      });
    });

    describe('#log', () => {
      context('when email is sent successfully on first attempt', () => {
        beforeEach(() => {
          sendMail.resolves({});
        });

        it('calls callback without error', async () => {
          const callback = sinon.spy();

          await transport.log({ message: 'test' }, callback);

          expect(callback).to.have.been.calledOnce;
        });

        it('sends the rendered message', async () => {
          await transport.log({ message: 'test' }, () => {});

          expect(sendMail).to.have.been.calledOnceWithExactly({
            from: MESSAGE_OPTIONS.from,
            to: MESSAGE_OPTIONS.to,
            subject: MESSAGE_OPTIONS.subject,
            text: 'test',
            html: '<p>test</p>',
          });
        });

        it('does not emit error event', async () => {
          const errorHandler = sinon.spy();

          transport.on('error', errorHandler);
          await transport.log({ message: 'test' }, () => {});

          expect(errorHandler).not.to.have.been.called;
        });

        it('does not log any warning', async () => {
          await transport.log({ message: 'test' }, () => {});

          expect(consoleWarnStub).not.to.have.been.called;
        });

        it('calls callback before the email is sent', () => {
          const callback = sinon.spy();

          sendMail.returns(new Promise(() => {}));
          transport.log({ message: 'test' }, callback);

          expect(callback).to.have.been.calledOnce;
        });
      });

      context('when email fails then succeeds on retry', () => {
        beforeEach(() => {
          sendMail.onFirstCall().rejects(new Error('SMTP timeout'));
          sendMail.onSecondCall().resolves({});
        });

        it('retries and eventually succeeds', async () => {
          const callback = sinon.spy();
          const logPromise = transport.log({ message: 'test' }, callback);

          await clock.tickAsync(RETRY_DELAYS[0]);
          await logPromise;

          expect(sendMail).to.have.been.calledTwice;
          expect(callback).to.have.been.calledOnce;
        });

        it('logs warning for failed attempt', async () => {
          const logPromise = transport.log({ message: 'test' }, () => {});

          await clock.tickAsync(RETRY_DELAYS[0]);
          await logPromise;

          expect(consoleWarnStub).to.have.been.calledOnce;
          expect(consoleWarnStub.firstCall.args[0]).to.include('SMTP mail sending failed');
          expect(consoleWarnStub.firstCall.args[0]).to.include('SMTP timeout');
        });
      });

      context('when email fails after all retry attempts', () => {
        beforeEach(() => {
          sendMail.rejects(new Error('SMTP timeout'));
        });

        it('does not emit an error event after all retries are exhausted', async () => {
          const errorHandler = sinon.spy();

          transport.on('error', errorHandler);
          await failAllAttempts(transport.log({ message: 'test' }, () => {}));

          expect(errorHandler).not.to.have.been.called;
        });

        it('calls callback even after failure', async () => {
          const callback = sinon.spy();

          await failAllAttempts(transport.log({ message: 'test' }, callback));

          expect(callback).to.have.been.calledOnce;
        });

        it('logs final failure warning', async () => {
          await failAllAttempts(transport.log({ message: 'test' }, () => {}));

          expect(consoleWarnStub.lastCall.args[0]).to.include(`failed after ${RETRY_DELAYS.length + 1} attempts`);
          expect(consoleWarnStub.lastCall.args[0]).to.include('Error: SMTP timeout');
        });
      });

      context('when email succeeds after multiple failures', () => {
        it('succeeds on third attempt', async () => {
          const callback = sinon.spy();
          const errorHandler = sinon.spy();

          sendMail.onFirstCall().rejects(new Error('SMTP timeout'));
          sendMail.onSecondCall().rejects(new Error('Connection refused'));
          sendMail.onThirdCall().resolves({});
          transport.on('error', errorHandler);

          const logPromise = transport.log({ message: 'test' }, callback);

          await clock.tickAsync(RETRY_DELAYS[0]);
          await clock.tickAsync(RETRY_DELAYS[1]);
          await logPromise;

          expect(sendMail).to.have.been.calledThrice;
          expect(callback).to.have.been.calledOnce;
          expect(errorHandler).not.to.have.been.called;
        });
      });
    });
  });

  context('when the message reaches the SMTP server', () => {
    const MESSAGE_WITH_PITFALLS = [
      'Line with a bare CR\rcontinued after it',
      '.Line starting with a dot',
      '.',
      'Line after a line made of a single dot',
      'Non-ASCII characters: é — 日本',
      `Long line: ${'x'.repeat(1200)}`,
    ].join('\n');

    const connections = [];
    let server;
    let received;
    let lines;

    const createTransport = () => new MailTransportWithRetry({ ...MESSAGE_OPTIONS, smtp: { host: '127.0.0.1', port: server.address().port, ignoreTLS: true } });

    before(async () => {
      server = net.createServer(socket => {
        connections.push(socket);

        let buffer = Buffer.alloc(0);
        let inData = false;
        const reply = text => socket.write(`${text}\r\n`);

        socket.on('data', chunk => {
          buffer = Buffer.concat([ buffer, chunk ]);

          while (buffer.length) {
            if (inData) {
              const end = buffer.indexOf('\r\n.\r\n');

              if (end == -1) {
                return;
              }
              received = buffer.subarray(0, end + 2);
              buffer = buffer.subarray(end + 5);
              inData = false;
              reply('250 OK');
              continue;
            }

            const lineEnd = buffer.indexOf('\r\n');

            if (lineEnd == -1) {
              return;
            }

            const command = buffer.subarray(0, lineEnd).toString().split(' ')[0].toUpperCase();

            buffer = buffer.subarray(lineEnd + 2);

            if (command == 'DATA') {
              inData = true;
              reply('354 Go ahead');
            } else if (command == 'QUIT') {
              reply('221 Bye');
              socket.end();
            } else {
              reply('250 OK');
            }
          }
        });
        reply('220 localhost ESMTP');
      });

      await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });

      transport = createTransport();
      await transport.log({ message: MESSAGE_WITH_PITFALLS }, () => {});
      lines = received.toString('latin1').split('\r\n');
    });

    after(() => {
      transport.transporter.close();
      server.close();
    });

    it('uses CRLF line endings only', () => {
      expect(received.toString('latin1')).not.to.match(/\r(?!\n)|(?<!\r)\n/);
    });

    it('keeps lines within the 998 characters limit', () => {
      expect(Math.max(...lines.map(line => line.length))).to.be.at.most(998);
    });

    it('sends ASCII bytes only, so that no part declared 7bit holds anything else', () => {
      expect([...received].filter(byte => byte > 0x7F)).to.be.empty;
    });

    it('escapes the dots at the start of lines, so that none ends the data early', () => {
      expect(lines.filter(line => line.startsWith('.') && !line.startsWith('..'))).to.be.empty;
    });

    it('sends a plain text part', () => {
      expect(received.toString('latin1')).to.match(/^Content-Type: text\/plain/m);
    });

    it('sends an HTML part', () => {
      expect(received.toString('latin1')).to.match(/^Content-Type: text\/html/m);
    });

    it('sends a burst of emails over a single connection', async () => {
      const burstTransport = createTransport();
      const connectionCount = connections.length;

      await Promise.all([ 1, 2, 3 ].map(index => burstTransport.log({ message: `Warning ${index}` }, () => {})));
      burstTransport.transporter.close();

      expect(connections.length - connectionCount).to.equal(1);
    });

    it('closes the connection once idle, so that it does not keep a finished process alive', async () => {
      const idleTransport = createTransport();
      const connectionCount = connections.length;

      await idleTransport.log({ message: 'test' }, () => {});

      const connection = connections[connectionCount];

      if (!connection.destroyed) {
        await once(connection, 'close');
      }
    });
  });
});
