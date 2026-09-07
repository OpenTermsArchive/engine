import { EventEmitter } from 'node:events';
import os from 'node:os';

import { expect, use } from 'chai';
import config from 'config';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import winston from 'winston';

import { createErrorMailTransports, handleTransportErrors } from './error-mail.js';
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
  let consoleWarnStub;
  let consoleErrorStub;

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
    };
    sinon.stub(config, 'get').callsFake(key => configValues[key]);
    consoleWarnStub = sinon.stub(console, 'warn');
    consoleErrorStub = sinon.stub(console, 'error');
    process.env.OTA_ENGINE_SMTP_PASSWORD = 'secret';
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('#createErrorMailTransports', () => {
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
        expect(createErrorMailTransports({ collection, component, subject, warningSubject })).to.be.empty;
      });

      it('does not warn', () => {
        createErrorMailTransports({ collection, component, subject, warningSubject });

        expect(consoleWarnStub).to.not.have.been.called;
      });
    });

    context('when the SMTP password is not defined', () => {
      beforeEach(() => {
        delete process.env.OTA_ENGINE_SMTP_PASSWORD;
      });

      it('returns no transport', () => {
        expect(createErrorMailTransports({ collection, component, subject, warningSubject })).to.be.empty;
      });

      it('warns that emails cannot be sent', () => {
        createErrorMailTransports({ collection, component, subject, warningSubject });

        expect(consoleWarnStub).to.have.been.calledOnce;
        expect(consoleWarnStub.firstCall.args[0]).to.include('OTA_ENGINE_SMTP_PASSWORD');
      });
    });

    context('when sending mail on error is enabled', () => {
      let transports;

      context('without warnings', () => {
        beforeEach(() => {
          transports = createErrorMailTransports({ collection, component, subject, warningSubject });
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
          transports = createErrorMailTransports({ collection, component, subject, warningSubject });
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
      });

      context('with warnings enabled but no subject for them', () => {
        beforeEach(() => {
          configValues['@opentermsarchive/engine.logger.sendMailOnError.sendWarnings'] = true;
          transports = createErrorMailTransports({ collection, component, subject });
        });

        it('returns the error transport only', () => {
          expect(transports).to.have.lengthOf(1);
          expect(transports[0].level).to.equal('error');
        });
      });

      context('with a subject for warnings but warnings disabled', () => {
        beforeEach(() => {
          transports = createErrorMailTransports({ collection, component, subject, warningSubject });
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
          [{ mailTransport: { formatter } }] = createErrorMailTransports({ collection, component, subject, warningSubject });
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

        context('when the collection has no deployment inventory', () => {
          beforeEach(() => {
            [{ mailTransport: { formatter } }] = createErrorMailTransports({ collection: { id: 'test', name: 'Test' }, component, subject, warningSubject });
            body = formatter({ message: 'Error', level: 'error' });
          });

          it('omits the command to connect to the server', () => {
            expect(body).to.not.include('ssh ');
          });
        });
      });
    });
  });

  describe('#handleTransportErrors', () => {
    let logger;
    let processExitStub;

    beforeEach(() => {
      logger = new EventEmitter();
      processExitStub = sinon.stub(process, 'exit');
      handleTransportErrors(logger);
    });

    context('when the error comes from the mail transport', () => {
      let error;

      beforeEach(() => {
        error = new Error('Connection refused');
        logger.emit('error', error, Object.create(MailTransportWithRetry.prototype));
      });

      it('does not exit the process', () => {
        expect(processExitStub).to.not.have.been.called;
      });

      it('warns with the error stack', () => {
        expect(consoleWarnStub).to.have.been.calledOnce;
        expect(consoleWarnStub.firstCall.args[0]).to.include(error.stack);
      });
    });

    context('when the error comes from another transport', () => {
      let error;

      beforeEach(() => {
        error = new Error('Broken pipe');
        logger.emit('error', error, new winston.transports.Console({ silent: true }));
      });

      it('exits the process with a failure code', () => {
        expect(processExitStub).to.have.been.calledOnceWithExactly(1);
      });

      it('prints the error before exiting', () => {
        expect(consoleErrorStub).to.have.been.calledOnceWithExactly(error);
      });
    });
  });
});
