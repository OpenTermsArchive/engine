import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import Git from '../../git/index.js';
import { ExtractDocumentError } from '../extract/index.js';
import { FetchDocumentError } from '../fetcher/index.js';
import { getDeclaredTerms } from '../services/index.js';
import SourceDocument from '../services/sourceDocument.js';

import { UnreadableRunError } from './errors.js';

import TrackingResults from './index.js';

use(sinonChai);

const DECLARATIONS_COMMIT = 'c0ffee1234567890c0ffee1234567890c0ffee12';

function makeRecorder(overrides = {}) {
  return {
    currentRun: null,
    initialize: sinon.stub().resolves(),
    finalize: sinon.stub().resolves(),
    startRun: sinon.stub().resolves(),
    recordTermsOutcome: sinon.stub().resolves(),
    completeRun: sinon.stub().resolves(),
    recoverCrashedRunIfAny: sinon.stub().resolves(null),
    ...overrides,
  };
}

function makeServices() { // Minimal stand-ins for the loaded services map, exposing the getTermsTypes(filter) and getNumberOfTerms(filter) contracts used by the run start
  const service = termsTypes => {
    const getTermsTypes = filter => (filter?.length ? termsTypes.filter(type => filter.includes(type)) : termsTypes);

    return { getTermsTypes, getNumberOfTerms: filter => getTermsTypes(filter).length };
  };

  return {
    'Service A': service([ 'Terms of Service', 'Privacy Policy' ]),
    'Service B': service(['Terms of Service']),
  };
}

function makeTerms() {
  const sourceDocument = new SourceDocument({ location: 'https://example.com/terms', contentSelectors: 'body' });

  sourceDocument.mimeType = 'text/html';
  sourceDocument.snapshotId = 'abc123';

  return { service: { id: 'Service A', name: 'Service A' }, type: 'Terms of Service', sourceDocuments: [sourceDocument] };
}

describe('TrackingResults', () => {
  let recorder;
  let subject;
  let warnings;

  beforeEach(() => {
    recorder = makeRecorder();
    subject = new TrackingResults({ recorder });
    warnings = [];
    subject.on('warn', ({ message }) => warnings.push(message));
  });

  describe('.create', () => {
    context('when the configured storage type is not git', () => {
      it('throws an error stating the supported type', async () => {
        const error = await TrackingResults.create({ storage: { type: 'mongo', mongo: {} } }).catch(error => error);

        expect(error.message).to.include('only "git" is supported');
      });
    });
  });

  describe('#initialize', () => {
    it('initialises the recorder and attempts crash recovery', async () => {
      await subject.initialize();

      expect(recorder.initialize).to.have.been.calledOnce;
      expect(recorder.recoverCrashedRunIfAny).to.have.been.calledOnce;
    });

    context('when a crashed run has been recovered', () => {
      beforeEach(() => {
        recorder.recoverCrashedRunIfAny.resolves({ shortRunId: 'ota-run-f47ac10b', coverage: { processed: 2, skipped: [{ serviceId: 'Service B', termsType: 'Terms of Service', reason: 'no outcome recorded before the engine crashed' }] } });
      });

      it('announces it', async () => {
        await subject.initialize();

        expect(warnings.join('\n')).to.include('Recovered crashed run ota-run-f47ac10b: persisted 2 processed terms and 1 skipped terms');
      });
    });

    context('when the declarations commit of the crashed run is not reachable', () => {
      let declaredTerms;

      beforeEach(() => {
        recorder.recoverCrashedRunIfAny.callsFake(async ({ getDeclaredTermsAtCommit }) => {
          declaredTerms = await getDeclaredTermsAtCommit('deadbeef'.repeat(5)); // Well-formed but unknown commit

          return null;
        });
      });

      it('falls back to the currently declared terms and reports the approximation', async () => {
        await subject.initialize();

        expect(declaredTerms).to.have.deep.members(await getDeclaredTerms());
        expect(warnings.join('\n')).to.include('is not reachable');
      });
    });

    context('when the repository cannot be initialized', () => {
      beforeEach(() => {
        recorder.initialize.onFirstCall().rejects(new Error('Unable to create index.lock'));
      });

      it('degrades with a warning instead of failing the engine initialization', async () => {
        await subject.initialize();

        expect(recorder.recoverCrashedRunIfAny).to.not.have.been.called;
        expect(warnings.join('\n')).to.include('Unable to create index.lock');
      });

      it('retries the initialization at the next run', async () => {
        await subject.initialize();
        await subject.startRun({ services: makeServices(), declarationsCommit: DECLARATIONS_COMMIT, selectedServicesIds: ['Service A'], selectedTermsTypes: [] });

        expect(recorder.initialize).to.have.been.calledTwice;
        expect(recorder.startRun).to.have.been.calledOnce;
      });
    });
  });

  describe('#getDeclarationsCommit', () => {
    afterEach(() => Git.getHeadSha.restore());

    it('resolves to the commit of the declarations repository', async () => {
      sinon.stub(Git, 'getHeadSha').resolves(DECLARATIONS_COMMIT);

      expect(await subject.getDeclarationsCommit()).to.equal(DECLARATIONS_COMMIT);
      expect(warnings).to.be.empty;
    });

    context('when the declarations are not versioned', () => {
      it('resolves to null and reports it', async () => {
        sinon.stub(Git, 'getHeadSha').resolves(null);

        expect(await subject.getDeclarationsCommit()).to.be.null;
        expect(warnings.join('\n')).to.include('is not a Git repository');
      });
    });

    context('when the commit cannot be read', () => {
      it('resolves to null and reports it', async () => {
        sinon.stub(Git, 'getHeadSha').rejects(new Error('git failure'));

        expect(await subject.getDeclarationsCommit()).to.be.null;
        expect(warnings.join('\n')).to.include('Could not read the declarations commit: git failure');
      });
    });
  });

  describe('#startRun', () => {
    it('starts a recorder run with the full declared counts and the unselected terms as skips', async () => {
      const services = makeServices();

      await subject.startRun({ services, declarationsCommit: DECLARATIONS_COMMIT, selectedServicesIds: ['Service A'], selectedTermsTypes: [] });

      expect(recorder.startRun).to.have.been.calledOnce;

      const { declarationsCommit, servicesCount, termsCount, skippedTerms } = recorder.startRun.firstCall.args[0];

      expect(declarationsCommit).to.equal(DECLARATIONS_COMMIT);
      expect(servicesCount).to.equal(2);
      expect(termsCount).to.equal(3);
      expect(skippedTerms).to.deep.equal([{ serviceId: 'Service B', termsType: 'Terms of Service', reason: 'not selected for this run' }]);
    });

    it('narrows the skips to the selected terms types', async () => {
      const services = makeServices();

      await subject.startRun({ services, declarationsCommit: DECLARATIONS_COMMIT, selectedServicesIds: [ 'Service A', 'Service B' ], selectedTermsTypes: ['Privacy Policy'] });

      const { skippedTerms } = recorder.startRun.firstCall.args[0];

      expect(skippedTerms).to.deep.equal([
        { serviceId: 'Service A', termsType: 'Terms of Service', reason: 'not selected for this run' },
        { serviceId: 'Service B', termsType: 'Terms of Service', reason: 'not selected for this run' },
      ]);
    });

    context('when the declarations commit is unknown', () => {
      it('does not start a recorder run', async () => {
        await subject.startRun({ services: makeServices(), declarationsCommit: null, selectedServicesIds: ['Service A'], selectedTermsTypes: [] });

        expect(recorder.startRun).to.not.have.been.called;
      });
    });

    context('when the recorder cannot start the run', () => {
      beforeEach(() => {
        recorder.startRun.rejects(new Error('Run start commit failed'));
      });

      it('degrades with a warning instead of failing the tracking run', async () => {
        await subject.startRun({ services: makeServices(), declarationsCommit: DECLARATIONS_COMMIT, selectedServicesIds: ['Service A'], selectedTermsTypes: [] });

        expect(subject.hasRunInProgress).to.be.false;
        expect(warnings.join('\n')).to.include('tracking-results is disabled for this run');
      });
    });

    context('when crash recovery keeps failing', () => {
      beforeEach(() => {
        recorder.recoverCrashedRunIfAny.rejects(new Error('transient git failure'));
      });

      it('does not start a recorder run', async () => { // A new Start run commit would hide the crashed run's reference SHA and make its recovery impossible forever
        await subject.startRun({ services: makeServices(), declarationsCommit: DECLARATIONS_COMMIT, selectedServicesIds: ['Service A'], selectedTermsTypes: [] });

        expect(recorder.startRun).to.not.have.been.called;
        expect(warnings.join('\n')).to.include('will be retried at the next one');
      });

      it('retries the recovery at the next run', async () => {
        await subject.startRun({ services: makeServices(), declarationsCommit: DECLARATIONS_COMMIT, selectedServicesIds: ['Service A'], selectedTermsTypes: [] });
        await subject.startRun({ services: makeServices(), declarationsCommit: DECLARATIONS_COMMIT, selectedServicesIds: ['Service A'], selectedTermsTypes: [] });

        expect(recorder.recoverCrashedRunIfAny).to.have.been.calledTwice;
      });
    });

    context('when the previous run.json is unreadable', () => {
      beforeEach(() => {
        recorder.recoverCrashedRunIfAny.rejects(new UnreadableRunError('Could not parse JSON'));
      });

      it('proceeds and announces the file will be overwritten', async () => {
        await subject.startRun({ services: makeServices(), declarationsCommit: DECLARATIONS_COMMIT, selectedServicesIds: ['Service A'], selectedTermsTypes: [] });

        expect(recorder.startRun).to.have.been.calledOnce;
        expect(warnings.join('\n')).to.include('it will be overwritten by the next run');
      });
    });

    context('when recovery already succeeded', () => {
      it('does not attempt it again', async () => {
        await subject.initialize();
        await subject.startRun({ services: makeServices(), declarationsCommit: DECLARATIONS_COMMIT, selectedServicesIds: ['Service A'], selectedTermsTypes: [] });

        expect(recorder.recoverCrashedRunIfAny).to.have.been.calledOnce;
      });
    });
  });

  describe('#recordSuccess', () => {
    context('when a run is in progress', () => {
      beforeEach(() => {
        recorder.currentRun = {};
      });

      it('maps the terms to the recorder payload', async () => {
        await subject.recordSuccess(makeTerms());

        expect(recorder.recordTermsOutcome).to.have.been.calledOnce;
        expect(recorder.recordTermsOutcome.firstCall.args[0]).to.deep.equal({
          serviceId: 'Service A',
          termsType: 'Terms of Service',
          serviceName: 'Service A',
          sourceDocuments: [{
            id: 'terms',
            fetch: 'https://example.com/terms',
            select: 'body',
            remove: undefined,
            filter: undefined,
            executeClientScripts: undefined,
            mimeType: 'text/html',
            snapshotId: 'abc123',
          }],
          status: 'ok',
          reasons: undefined,
          transientErrorReasons: undefined,
        });
      });

      it('normalises the MIME type reported by the fetcher', async () => {
        const terms = makeTerms();

        terms.sourceDocuments[0].mimeType = 'text/html; charset=utf-8';
        await subject.recordSuccess(terms);

        expect(recorder.recordTermsOutcome.firstCall.args[0].sourceDocuments[0].mimeType).to.equal('text/html');
      });

      it('records a missing MIME type as null', async () => {
        const terms = makeTerms();

        terms.sourceDocuments[0].mimeType = undefined;
        await subject.recordSuccess(terms);

        expect(recorder.recordTermsOutcome.firstCall.args[0].sourceDocuments[0].mimeType).to.be.null;
      });

      it('categorises the transient errors', async () => {
        await subject.recordSuccess(makeTerms(), { transientErrors: [new FetchDocumentError('HTTP code 503')] });

        expect(recorder.recordTermsOutcome.firstCall.args[0].transientErrorReasons).to.deep.equal(['[fetch] Fetch failed: HTTP code 503']);
      });
    });

    context('when no run is in progress', () => {
      it('records nothing', async () => {
        await subject.recordSuccess(makeTerms());

        expect(recorder.recordTermsOutcome).to.not.have.been.called;
      });
    });
  });

  describe('#recordFailure', () => {
    beforeEach(() => {
      recorder.currentRun = {};
    });

    it('categorises each error by origin', async () => {
      await subject.recordFailure(makeTerms(), [
        new FetchDocumentError('HTTP code 500'),
        new ExtractDocumentError('CSS selector has no match'),
        new Error('Could not commit /home/ota/data/snapshots/Service/Terms.html'),
      ]);

      expect(recorder.recordTermsOutcome.firstCall.args[0].status).to.equal('failed');
      expect(recorder.recordTermsOutcome.firstCall.args[0].reasons).to.deep.equal([
        '[fetch] Fetch failed: HTTP code 500',
        '[extraction] Extract failed: CSS selector has no match',
        '[internal] Unexpected engine error',
      ]);
    });
  });

  describe('#completeRun and #finalize', () => {
    it('delegate to the recorder', async () => {
      await subject.initialize();
      await subject.completeRun();
      await subject.finalize();

      expect(recorder.completeRun).to.have.been.calledOnce;
      expect(recorder.finalize).to.have.been.calledOnce;
    });

    context('when the repository could not be initialized', () => {
      beforeEach(() => {
        recorder.initialize.rejects(new Error('Unable to create index.lock'));
      });

      it('does not finalize it', async () => {
        await subject.initialize();
        await subject.finalize();

        expect(recorder.finalize).to.not.have.been.called;
      });
    });

    context('when the push fails at finalize', () => {
      beforeEach(() => {
        recorder.finalize.rejects(new Error('remote rejected'));
      });

      it('degrades with a warning, as the commits remain local', async () => {
        await subject.initialize();
        await subject.finalize();

        expect(warnings.join('\n')).to.include('recorded commits are kept locally');
      });
    });
  });

  describe('#hasRunInProgress', () => {
    it('reflects the recorder state', () => {
      expect(subject.hasRunInProgress).to.be.false;
      recorder.currentRun = {};
      expect(subject.hasRunInProgress).to.be.true;
    });
  });

  describe('#currentRunId', () => {
    it('returns null when no run is in progress', () => {
      expect(subject.currentRunId).to.be.null;
    });

    it('returns the id of the run in progress', () => {
      recorder.currentRun = { runId: 'ota-run-f47ac10b-58cc-4372-a567-0e02b2c3d479' };
      expect(subject.currentRunId).to.equal('ota-run-f47ac10b-58cc-4372-a567-0e02b2c3d479');
    });
  });
});
