import { EventEmitter } from 'node:events';

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
    const formatter = ({ message }) => message;
    const subject = 'Error on test collection';
    const warningSubject = 'Warning on test collection';

    context('when sending mail on error is disabled', () => {
      beforeEach(() => {
        configValues['@opentermsarchive/engine.logger.sendMailOnError'] = false;
      });

      it('returns no transport', () => {
        expect(createErrorMailTransports({ formatter, subject, warningSubject })).to.be.empty;
      });

      it('does not warn', () => {
        createErrorMailTransports({ formatter, subject, warningSubject });

        expect(consoleWarnStub).to.not.have.been.called;
      });
    });

    context('when the SMTP password is not defined', () => {
      beforeEach(() => {
        delete process.env.OTA_ENGINE_SMTP_PASSWORD;
      });

      it('returns no transport', () => {
        expect(createErrorMailTransports({ formatter, subject, warningSubject })).to.be.empty;
      });

      it('warns that emails cannot be sent', () => {
        createErrorMailTransports({ formatter, subject, warningSubject });

        expect(consoleWarnStub).to.have.been.calledOnce;
        expect(consoleWarnStub.firstCall.args[0]).to.include('OTA_ENGINE_SMTP_PASSWORD');
      });
    });

    context('when sending mail on error is enabled', () => {
      let transports;

      context('without warnings', () => {
        beforeEach(() => {
          transports = createErrorMailTransports({ formatter, subject, warningSubject });
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

        it('uses the given formatter', () => {
          expect(transports[0].mailTransport.formatter).to.equal(formatter);
        });

        it('handles unhandled rejections', () => {
          expect(transports[0].handleRejections).to.be.true;
        });
      });

      context('with warnings enabled and a subject for them', () => {
        beforeEach(() => {
          configValues['@opentermsarchive/engine.logger.sendMailOnError.sendWarnings'] = true;
          transports = createErrorMailTransports({ formatter, subject, warningSubject });
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
          transports = createErrorMailTransports({ formatter, subject });
        });

        it('returns the error transport only', () => {
          expect(transports).to.have.lengthOf(1);
          expect(transports[0].level).to.equal('error');
        });
      });

      context('with a subject for warnings but warnings disabled', () => {
        beforeEach(() => {
          transports = createErrorMailTransports({ formatter, subject, warningSubject });
        });

        it('returns the error transport only', () => {
          expect(transports).to.have.lengthOf(1);
          expect(transports[0].level).to.equal('error');
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
