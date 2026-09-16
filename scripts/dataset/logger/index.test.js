import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import logger, { createModuleLogger } from './index.js';

use(sinonChai);

describe('Dataset logger', () => {
  describe('#createModuleLogger', () => {
    const MODULE_NAME = 'test-module';
    let moduleLogger;

    before(() => {
      moduleLogger = createModuleLogger(MODULE_NAME);
    });

    afterEach(() => {
      sinon.restore();
    });

    [ 'debug', 'info', 'warn', 'error' ].forEach(level => {
      it(`forwards ${level} messages to the logger with the module name`, () => {
        const stub = sinon.stub(logger, level);

        moduleLogger[level]('message');

        expect(stub).to.have.been.calledOnceWithExactly('message', { module: MODULE_NAME });
      });
    });
  });
});
