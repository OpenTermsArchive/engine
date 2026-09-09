import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import winston from 'winston';

import logger from './index.js';

use(sinonChai);

describe('Logger', () => {
  let transport;
  let logSpy;

  beforeEach(() => {
    logSpy = sinon.spy();
    transport = new winston.transports.Console({ handleRejections: true });
    transport.log = (info, callback) => {
      logSpy(info);
      callback();
    };
    logger.add(transport);
    sinon.stub(process, 'exit');
  });

  afterEach(() => {
    logger.remove(transport);
    sinon.restore();
  });

  it('logs an unhandled rejection once per transport', async () => {
    logger.rejections._unhandledRejection(new Error('boom')); // eslint-disable-line no-underscore-dangle

    await new Promise(resolve => { setImmediate(resolve); });

    expect(logSpy).to.have.been.calledOnce;
    expect(logSpy.firstCall.args[0].rejection).to.be.true;
  });
});
