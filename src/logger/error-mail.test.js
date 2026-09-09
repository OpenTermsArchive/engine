import { EventEmitter } from 'node:events';
import os from 'node:os';

import { expect, use } from 'chai';
import config from 'config';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import winston from 'winston';

import { addErrorMail, createErrorMailTransports, exitOnUnhandledRejection } from './error-mail.js';
import MailTransportWithRetry from './mail-transport-with-retry.js';

use(sinonChai);

const SEND_MAIL_ON_ERROR = {
  to: 'admin@example.com',
  from: 'noreply@example.com',
  sendWarnings: false,
};

describe('Error mail', () => {
  let configValues;
  let originalPassword;
  let getEnvStub;

  before(() => {
    originalPassword = process.env.OTA_ENGINE_SMTP_PASSWORD;
  });

  after(() => {
    if (originalPassword === undefined) {
      delete process.env.OTA_ENGINE_SMTP_PASSWORD;
    } else {
      process.env.OTA_ENGINE_SMTP_PASSWORD = originalPassword;
    }
  });

  beforeEach(() => {
    configValues = {
      '@opentermsarchive/engine.logger.sendMailOnError': SEND_MAIL_ON_ERROR,
      '@opentermsarchive/engine.logger.sendMailOnError.to': SEND_MAIL_ON_ERROR.to,
      '@opentermsarchive/engine.logger.sendMailOnError.from': SEND_MAIL_ON_ERROR.from,
      '@opentermsarchive/engine.logger.sendMailOnError.sendWarnings': SEND_MAIL_ON_ERROR.sendWarnings,
      '@opentermsarchive/engine.logger.smtp.host': 'smtp.example.com',
      '@opentermsarchive/engine.logger.smtp.port': 587,
      '@opentermsarchive/engine.logger.smtp.username': 'user',
      '@opentermsarchive/engine.collectionPath': './test/test-declarations',
    };
    sinon.stub(config, 'get').callsFake(key => configValues[key]);
    sinon.stub(config, 'has').callsFake(key => configValues[key] !== undefined);
    getEnvStub = sinon.stub(config.util, 'getEnv').returns('production');
    process.env.OTA_ENGINE_SMTP_PASSWORD = 'secret';
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('#createErrorMailTransports', () => {
    const logger = { warn: () => {} };
    const collection = {
      id: 'test',
      name: 'Test',
      host: '203.0.113.1',
      hostConfig: { ansible_user: 'ota' },
    };
    const component = 'test component';
    const subject = 'Error on test collection';
    const warningSubject = 'Warning on test collection';

    context('when sending mail on error is disabled', () => {
      beforeEach(() => {
        configValues['@opentermsarchive/engine.logger.sendMailOnError'] = false;
      });

      it('returns no transport', () => {
        expect(createErrorMailTransports(logger, { collection, component, subject, warningSubject })).to.be.empty;
      });

      it('does not warn', () => {
        const warnSpy = sinon.spy(logger, 'warn');

        createErrorMailTransports(logger, { collection, component, subject, warningSubject });

        expect(warnSpy).to.not.have.been.called;
      });
    });

    context('when the SMTP password is not defined', () => {
      beforeEach(() => {
        delete process.env.OTA_ENGINE_SMTP_PASSWORD;
      });

      it('returns no transport', () => {
        expect(createErrorMailTransports(logger, { collection, component, subject, warningSubject })).to.be.empty;
      });

      it('warns through the logger that emails cannot be sent', () => {
        const warnSpy = sinon.spy(logger, 'warn');

        createErrorMailTransports(logger, { collection, component, subject, warningSubject });

        expect(warnSpy).to.have.been.calledOnce;
        expect(warnSpy.firstCall.args[0]).to.include('OTA_ENGINE_SMTP_PASSWORD');
      });
    });

    context('when sending mail on error is enabled', () => {
      let transports;

      context('without warnings', () => {
        beforeEach(() => {
          transports = createErrorMailTransports(logger, { collection, component, subject, warningSubject });
        });

        it('returns a single transport', () => {
          expect(transports).to.have.lengthOf(1);
        });

        it('returns a mail transport with retry', () => {
          expect(transports[0]).to.be.an.instanceOf(MailTransportWithRetry);
        });

        it('sends errors only', () => {
          expect(transports[0].level).to.equal('error');
        });

        it('uses the given subject', () => {
          expect(transports[0].mailTransport.subject).to.equal(subject);
        });

        it('uses the configured recipient and sender', () => {
          expect(transports[0].mailTransport.to).to.equal(SEND_MAIL_ON_ERROR.to);
          expect(transports[0].mailTransport.from).to.equal(SEND_MAIL_ON_ERROR.from);
        });

        it('sends HTML emails', () => {
          expect(transports[0].mailTransport.html).to.be.true;
        });

        it('handles unhandled rejections', () => {
          expect(transports[0].handleRejections).to.be.true;
        });
      });

      context('with warnings enabled and a subject for them', () => {
        beforeEach(() => {
          configValues['@opentermsarchive/engine.logger.sendMailOnError.sendWarnings'] = true;
          transports = createErrorMailTransports(logger, { collection, component, subject, warningSubject });
        });

        it('returns two transports', () => {
          expect(transports).to.have.lengthOf(2);
        });

        it('sends warnings with the second transport', () => {
          expect(transports[1].level).to.equal('warn');
        });

        it('uses the warning subject for the second transport', () => {
          expect(transports[1].mailTransport.subject).to.equal(warningSubject);
        });

        context('when logging through both transports', () => {
          let sent;

          beforeEach(() => {
            sent = [];
            transports.forEach((transport, index) => {
              sinon.stub(transport.mailTransport, 'log').callsFake((info, callback) => {
                sent.push(index);
                setImmediate(() => {
                  transport.mailTransport.emit('logged');
                  callback();
                });
              });
            });
          });

          it('sends errors through the error transport only', async () => {
            const logger = winston.createLogger({ format: winston.format.colorize(), transports });

            logger.error('boom');
            await new Promise(resolve => { setTimeout(resolve, 10); });

            expect(sent).to.deep.equal([0]);
          });

          it('sends warnings through the warning transport only', async () => {
            const logger = winston.createLogger({ format: winston.format.colorize(), transports });

            logger.warn('inaccessible');
            await new Promise(resolve => { setTimeout(resolve, 10); });

            expect(sent).to.deep.equal([1]);
          });
        });
      });

      context('with warnings enabled but no subject for them', () => {
        beforeEach(() => {
          configValues['@opentermsarchive/engine.logger.sendMailOnError.sendWarnings'] = true;
          transports = createErrorMailTransports(logger, { collection, component, subject });
        });

        it('returns the error transport only', () => {
          expect(transports).to.have.lengthOf(1);
          expect(transports[0].level).to.equal('error');
        });
      });

      context('with a subject for warnings but warnings not configured', () => {
        beforeEach(() => {
          delete configValues['@opentermsarchive/engine.logger.sendMailOnError.sendWarnings'];
          transports = createErrorMailTransports(logger, { collection, component, subject, warningSubject });
        });

        it('returns the error transport only', () => {
          expect(transports).to.have.lengthOf(1);
          expect(transports[0].level).to.equal('error');
        });
      });

      context('with a subject for warnings but warnings disabled', () => {
        beforeEach(() => {
          transports = createErrorMailTransports(logger, { collection, component, subject, warningSubject });
        });

        it('returns the error transport only', () => {
          expect(transports).to.have.lengthOf(1);
          expect(transports[0].level).to.equal('error');
        });
      });

      context('email body', () => {
        let formatter;
        let body;

        beforeEach(() => {
          [{ mailTransport: { formatter } }] = createErrorMailTransports(logger, { collection, component, subject, warningSubject });
        });

        context('for an error', () => {
          beforeEach(() => {
            body = formatter({ message: 'Error: <boom> & co', level: 'error' });
          });

          it('is titled as an error', () => {
            expect(body).to.include('Error details');
          });

          it('includes the escaped message', () => {
            expect(body).to.include('Error: &lt;boom&gt; &amp; co');
            expect(body).to.not.include('<boom>');
          });

          it('names the collection', () => {
            expect(body).to.include(`${collection.name} Collection`);
          });

          it('names the component', () => {
            expect(body).to.include(`Open Terms Archive ${component} error report`);
          });

          it('includes the hostname', () => {
            expect(body).to.include(os.hostname());
          });

          it('includes the time of the error', () => {
            expect(formatter({ message: 'Error', level: 'error', timestamp: '2026-09-09T10:00:00+02:00' })).to.include('Time: 2026-09-09T10:00:00+02:00');
          });

          it('includes the command to connect to the server', () => {
            expect(body).to.include(`ssh ${collection.hostConfig.ansible_user}@${collection.host}`);
          });
        });

        context('for a warning', () => {
          beforeEach(() => {
            body = formatter({ message: 'Inaccessible content', level: 'warn' });
          });

          it('is titled as a warning', () => {
            expect(body).to.include('Warning details');
          });
        });

        context('when interpolated values contain HTML characters', () => {
          beforeEach(() => {
            [{ mailTransport: { formatter } }] = createErrorMailTransports(logger, { collection: { id: 'test', name: 'R&D <beta>', host: '203.0.113.1', hostConfig: { ansible_user: 'ota<x>' } }, component: 'API <v2>', subject, warningSubject });
            body = formatter({ message: 'Error', level: 'error' });
          });

          it('escapes the collection name', () => {
            expect(body).to.include('R&amp;D &lt;beta&gt; Collection');
            expect(body).to.not.include('<beta>');
          });

          it('escapes the component', () => {
            expect(body).to.include('Open Terms Archive API &lt;v2&gt; error report');
          });

          it('escapes the command to connect to the server', () => {
            expect(body).to.include('ssh ota&lt;x&gt;@203.0.113.1');
            expect(body).to.not.include('ota<x>');
          });

          it('escapes the commands placeholders', () => {
            expect(body).to.include('pm2 logs &lt;process-name&gt;');
          });
        });

        context('when the collection has no deployment inventory', () => {
          beforeEach(() => {
            [{ mailTransport: { formatter } }] = createErrorMailTransports(logger, { collection: { id: 'test', name: 'Test' }, component, subject, warningSubject });
            body = formatter({ message: 'Error', level: 'error' });
          });

          it('omits the command to connect to the server', () => {
            expect(body).to.not.include('ssh ');
          });
        });
      });

      context('outside production', () => {
        beforeEach(() => {
          getEnvStub.returns('staging');
          configValues['@opentermsarchive/engine.logger.sendMailOnError.sendWarnings'] = true;
          transports = createErrorMailTransports(logger, { collection, component, subject, warningSubject });
        });

        it('prefixes the error subject with the environment', () => {
          expect(transports[0].mailTransport.subject).to.equal(`[staging] ${subject}`);
        });

        it('prefixes the warning subject with the environment', () => {
          expect(transports[1].mailTransport.subject).to.equal(`[staging] ${warningSubject}`);
        });

        it('prefixes the title of the body with the environment', () => {
          expect(transports[0].mailTransport.formatter({ message: 'Error', level: 'error' })).to.include(`[staging] Open Terms Archive ${component} error report`);
        });
      });
    });
  });

  describe('#addErrorMail', () => {
    let logger;
    let warnSpy;

    beforeEach(() => {
      logger = winston.createLogger({ transports: [new winston.transports.Console({ silent: true })], exitOnError: false });
      warnSpy = sinon.spy(logger, 'warn');
    });

    context('when sending mail on error is enabled with warnings', () => {
      beforeEach(async () => {
        configValues['@opentermsarchive/engine.logger.sendMailOnError.sendWarnings'] = true;
        await addErrorMail(logger, { component: 'engine', subject: 'Server error', warningSubject: 'Inaccessible content' }, { emitter: new EventEmitter() });
      });

      it('adds the mail transports to the logger', () => {
        expect(logger.transports).to.have.lengthOf(3);
        expect(logger.transports[1]).to.be.an.instanceOf(MailTransportWithRetry);
        expect(logger.transports[2]).to.be.an.instanceOf(MailTransportWithRetry);
      });

      it('names the collection in the subjects', () => {
        expect(logger.transports[1].mailTransport.subject).to.equal('Server error on test collection');
        expect(logger.transports[2].mailTransport.subject).to.equal('Inaccessible content on test collection');
      });
    });

    context('when the SMTP password is not defined', () => {
      beforeEach(async () => {
        delete process.env.OTA_ENGINE_SMTP_PASSWORD;
        await addErrorMail(logger, { component: 'engine', subject: 'Server error' }, { emitter: new EventEmitter() });
      });

      it('warns through the logger', () => {
        expect(warnSpy).to.have.been.calledOnce;
        expect(warnSpy.firstCall.args[0]).to.include('OTA_ENGINE_SMTP_PASSWORD');
      });

      it('adds no transport', () => {
        expect(logger.transports).to.have.lengthOf(1);
      });
    });
  });

  describe('#exitOnUnhandledRejection', () => {
    let emitter;
    let processExitStub;
    let mailTransport;
    let sent;

    const tick = () => new Promise(resolve => { setImmediate(resolve); });

    beforeEach(() => {
      emitter = new EventEmitter();
      processExitStub = sinon.stub(process, 'exit');
      mailTransport = Object.create(MailTransportWithRetry.prototype);
      mailTransport.flush = () => new Promise(resolve => { sent = resolve; });
      exitOnUnhandledRejection([ new winston.transports.Console({ silent: true }), mailTransport ], { emitter });
      emitter.emit('unhandledRejection', new Error('boom'));
    });

    it('waits for pending emails before exiting', async () => {
      await tick();
      await tick();

      expect(processExitStub).to.not.have.been.called;
    });

    it('exits with a failure code once emails are sent', async () => {
      await tick();
      sent();
      await tick();

      expect(processExitStub).to.have.been.calledOnceWithExactly(1);
    });
  });
});
