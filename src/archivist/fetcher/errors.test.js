import { expect } from 'chai';

import { FetchDocumentError } from './errors.js';

describe('FetchDocumentError', () => {
  describe('constructor', () => {
    it('formats the error message with "Fetch failed:" prefix', () => {
      const error = new FetchDocumentError('test error');

      expect(error.message).to.equal('Fetch failed: test error');
    });

    it('sets the error name correctly', () => {
      const error = new FetchDocumentError('test error');

      expect(error.name).to.equal('FetchDocumentError');
    });
  });

  describe('#mayBeTransient', () => {
    describe('transient errors', () => {
      FetchDocumentError.LIKELY_TRANSIENT_ERRORS.forEach(errorCode => {
        it(`returns true for ${errorCode}`, () => {
          const error = new FetchDocumentError(errorCode);

          expect(error.mayBeTransient).to.be.true;
        });
      });
    });

    describe('non-transient errors', () => {
      [
        'HTTP code 403',
        'HTTP code 404',
        'HTTP code 429',
      ].forEach(errorMessage => {
        it(`returns false for "${errorMessage}"`, () => {
          const error = new FetchDocumentError(errorMessage);

          expect(error.mayBeTransient).to.be.false;
        });
      });
    });
  });
});
