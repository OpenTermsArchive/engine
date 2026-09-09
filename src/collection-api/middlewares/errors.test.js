import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import errorsMiddleware from './errors.js';

use(sinonChai);

describe('Errors middleware', () => {
  const error = new Error('Boom');

  let res;
  let next;

  beforeEach(() => {
    res = {
      status: sinon.stub().returnsThis(),
      json: sinon.stub(),
    };
    next = sinon.stub();
  });

  context('when no response has been sent yet', () => {
    beforeEach(() => {
      res.headersSent = false;
      errorsMiddleware(error, {}, res, next);
    });

    it('responds with 500 status code', () => {
      expect(res.status).to.have.been.calledOnceWith(500);
    });

    it('responds with a generic JSON error', () => {
      expect(res.json).to.have.been.calledOnceWith({ error: 'Internal Server Error' });
    });

    it('does not call next', () => {
      expect(next).to.not.have.been.called;
    });
  });

  context('when headers have already been sent', () => {
    beforeEach(() => {
      res.headersSent = true;
      errorsMiddleware(error, {}, res, next);
    });

    it('forwards the error to the default Express handler instead of responding again', () => {
      expect(next).to.have.been.calledOnceWith(error);
    });

    it('does not attempt to set a status code', () => {
      expect(res.status).to.not.have.been.called;
    });
  });
});
