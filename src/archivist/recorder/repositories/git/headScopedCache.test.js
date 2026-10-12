import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

import HeadScopedCache from './headScopedCache.js';

use(chaiAsPromised);

describe('HeadScopedCache', () => {
  const KEY = 'revisions:service';
  const HEAD = 'a'.repeat(40);
  const NEW_HEAD = 'b'.repeat(40);
  let subject;

  beforeEach(() => {
    subject = new HeadScopedCache();
  });

  context('when HEAD has not moved since the previous computation', () => {
    it('returns the stored result without computing it again', async () => {
      const compute = sinon.stub().resolves('result');

      await subject.get(KEY, HEAD, compute);

      expect(await subject.get(KEY, HEAD, compute)).to.equal('result');
      expect(compute.callCount).to.equal(1);
    });
  });

  context('when HEAD has moved since the previous computation', () => {
    it('computes the result again, from the previous entry', async () => {
      const compute = sinon.stub();

      compute.onFirstCall().resolves('previous result');
      compute.onSecondCall().resolves('new result');

      await subject.get(KEY, HEAD, compute);

      expect(await subject.get(KEY, NEW_HEAD, compute)).to.equal('new result');
      expect(compute.secondCall.args[0].head).to.equal(HEAD);
      expect(await compute.secondCall.args[0].promise).to.equal('previous result');
    });
  });

  context('when called several times at once', () => {
    it('shares a single computation', async () => {
      const compute = sinon.stub().resolves('result');

      expect(await Promise.all([ subject.get(KEY, HEAD, compute), subject.get(KEY, HEAD, compute) ])).to.deep.equal([ 'result', 'result' ]);
      expect(compute.callCount).to.equal(1);
    });
  });

  context('when the computation fails', () => {
    it('computes the result again at the next call', async () => {
      const compute = sinon.stub();

      compute.onFirstCall().rejects(new Error('git failure'));
      compute.onSecondCall().resolves('result');

      await expect(subject.get(KEY, HEAD, compute)).to.be.rejectedWith('git failure');

      expect(await subject.get(KEY, HEAD, compute)).to.equal('result');
    });

    it('keeps a result computed meanwhile for a newer HEAD', async () => {
      let failComputation;
      const failingCompute = () => new Promise((resolve, reject) => { failComputation = reject; });
      const failingCall = subject.get(KEY, HEAD, failingCompute);

      await subject.get(KEY, NEW_HEAD, () => Promise.resolve('new result'));
      failComputation(new Error('git failure'));
      await expect(failingCall).to.be.rejected;

      const compute = sinon.stub().resolves('recomputed result');

      expect(await subject.get(KEY, NEW_HEAD, compute)).to.equal('new result');
      expect(compute.called).to.be.false;
    });
  });

  context('when more keys than the maximum are stored', () => {
    it('forgets the oldest one', async () => {
      const boundedSubject = new HeadScopedCache({ maxEntries: 2 });
      const compute = sinon.stub().resolves('result');

      await boundedSubject.get('first', HEAD, compute);
      await boundedSubject.get('second', HEAD, compute);
      await boundedSubject.get('third', HEAD, compute);
      await boundedSubject.get('second', HEAD, compute);
      await boundedSubject.get('first', HEAD, compute);

      expect(compute.callCount).to.equal(4);
    });
  });
});
