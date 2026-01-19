import { EventEmitter } from 'node:events';

import { expect } from 'chai';
import sinon from 'sinon';
import winston from 'winston';

import MailTransportWithRetry, { RETRY_DELAYS } from './mail-transport-with-retry.js';

class MockMailTransport extends EventEmitter {
  log() {} // eslint-disable-line
}

describe('MailTransportWithRetry', () => {
  let clock;
  let mockMailTransport;
  let transport;
  let consoleWarnStub;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    mockMailTransport = new MockMailTransport();
    sinon.stub(winston.transports, 'Mail').returns(mockMailTransport);
    consoleWarnStub = sinon.stub(console, 'warn');
    transport = new MailTransportWithRetry({ to: 'test@example.com' });
  });

  afterEach(() => {
    sinon.restore();
    clock.restore();
  });

  describe('#log', () => {
    context('when email is sent successfully on first attempt', () => {
      it('calls callback without error', async () => {
        const callback = sinon.spy();
        const logPromise = transport.log({ message: 'test' }, callback);

        mockMailTransport.emit('logged');
        await logPromise;

        expect(callback).to.have.been.calledOnce;
      });

      it('does not emit error event', async () => {
        const errorHandler = sinon.spy();

        transport.on('error', errorHandler);

        const logPromise = transport.log({ message: 'test' }, () => {});

        mockMailTransport.emit('logged');
        await logPromise;

        expect(errorHandler).not.to.have.been.called;
      });

      it('does not log any warning', async () => {
        const logPromise = transport.log({ message: 'test' }, () => {});

        mockMailTransport.emit('logged');
        await logPromise;

        expect(consoleWarnStub).not.to.have.been.called;
      });
    });

    context('when email fails then succeeds on retry', () => {
      it('retries and eventually succeeds', async () => {
        const callback = sinon.spy();
        const logSpy = sinon.spy(mockMailTransport, 'log');
        const logPromise = transport.log({ message: 'test' }, callback);

        mockMailTransport.emit('error', new Error('SMTP timeout'));

        await clock.tickAsync(RETRY_DELAYS[0]);

        mockMailTransport.emit('logged');
        await logPromise;

        expect(logSpy).to.have.been.calledTwice;
        expect(callback).to.have.been.calledOnce;
      });

      it('logs warning for failed attempt', async () => {
        const logPromise = transport.log({ message: 'test' }, () => {});

        mockMailTransport.emit('error', new Error('SMTP timeout'));

        await clock.tickAsync(RETRY_DELAYS[0]);

        mockMailTransport.emit('logged');
        await logPromise;

        expect(consoleWarnStub).to.have.been.calledOnce;
        expect(consoleWarnStub.firstCall.args[0]).to.include('SMTP mail sending failed');
        expect(consoleWarnStub.firstCall.args[0]).to.include('SMTP timeout');
      });
    });

    context('when email fails after all retry attempts', () => {
      it('emits error event after all retries are exhausted', async () => {
        const errorHandler = sinon.spy();

        transport.on('error', errorHandler);

        const logPromise = transport.log({ message: 'test' }, () => {});

        mockMailTransport.emit('error', new Error('SMTP timeout'));
        await clock.tickAsync(RETRY_DELAYS[0]);

        mockMailTransport.emit('error', new Error('SMTP timeout'));
        await clock.tickAsync(RETRY_DELAYS[1]);

        mockMailTransport.emit('error', new Error('SMTP timeout'));
        await clock.tickAsync(RETRY_DELAYS[2]);

        mockMailTransport.emit('error', new Error('SMTP timeout'));
        await logPromise;

        expect(errorHandler).to.have.been.calledOnce;
        expect(errorHandler.firstCall.args[0].message).to.equal('SMTP timeout');
      });

      it('calls callback even after failure', async () => {
        const callback = sinon.spy();

        transport.on('error', () => {}); // Prevent unhandled error

        const logPromise = transport.log({ message: 'test' }, callback);

        mockMailTransport.emit('error', new Error('SMTP timeout'));
        await clock.tickAsync(RETRY_DELAYS[0]);

        mockMailTransport.emit('error', new Error('SMTP timeout'));
        await clock.tickAsync(RETRY_DELAYS[1]);

        mockMailTransport.emit('error', new Error('SMTP timeout'));
        await clock.tickAsync(RETRY_DELAYS[2]);

        mockMailTransport.emit('error', new Error('SMTP timeout'));
        await logPromise;

        expect(callback).to.have.been.calledOnce;
      });

      it('logs final failure warning', async () => {
        transport.on('error', () => {}); // Prevent unhandled error

        const logPromise = transport.log({ message: 'test' }, () => {});

        mockMailTransport.emit('error', new Error('SMTP timeout'));
        await clock.tickAsync(RETRY_DELAYS[0]);

        mockMailTransport.emit('error', new Error('SMTP timeout'));
        await clock.tickAsync(RETRY_DELAYS[1]);

        mockMailTransport.emit('error', new Error('SMTP timeout'));
        await clock.tickAsync(RETRY_DELAYS[2]);

        mockMailTransport.emit('error', new Error('SMTP timeout'));
        await logPromise;

        expect(consoleWarnStub.lastCall.args[0]).to.include(`failed after ${RETRY_DELAYS.length + 1} attempts`);
      });
    });

    context('when email succeeds after multiple failures', () => {
      it('succeeds on third attempt', async () => {
        const callback = sinon.spy();
        const errorHandler = sinon.spy();
        const logSpy = sinon.spy(mockMailTransport, 'log');

        transport.on('error', errorHandler);

        const logPromise = transport.log({ message: 'test' }, callback);

        mockMailTransport.emit('error', new Error('SMTP timeout'));
        await clock.tickAsync(RETRY_DELAYS[0]);

        mockMailTransport.emit('error', new Error('Connection refused'));
        await clock.tickAsync(RETRY_DELAYS[1]);

        mockMailTransport.emit('logged');
        await logPromise;

        expect(logSpy).to.have.been.calledThrice;
        expect(callback).to.have.been.calledOnce;
        expect(errorHandler).not.to.have.been.called;
      });
    });
  });
});
