import { createRequire } from 'module';

import { expect } from 'chai';
import nock from 'nock';

import GitHub from './github.js';

const require = createRequire(import.meta.url);

describe('GitHub', function () {
  this.timeout(5000);

  let MANAGED_LABELS;
  let github;

  before(() => {
    MANAGED_LABELS = require('./labels.json');
    github = new GitHub('owner/repo');
  });

  describe('#initialize', () => {
    const scopes = [];

    before(async () => {
      const existingLabels = MANAGED_LABELS.slice(0, -2);

      nock('https://api.github.com')
        .get('/repos/owner/repo/labels')
        .reply(200, existingLabels);

      const missingLabels = MANAGED_LABELS.slice(-2);

      for (const label of missingLabels) {
        scopes.push(nock('https://api.github.com')
          .post('/repos/owner/repo/labels', body => body.name === label.name)
          .reply(200, label));
      }

      await github.initialize();
    });

    after(nock.cleanAll);

    it('should create missing labels', () => {
      scopes.forEach(scope => expect(scope.isDone()).to.be.true);
    });
  });

  describe('#getRepositoryLabels', () => {
    let scope;
    let result;
    const LABELS = [{ name: 'bug' }, { name: 'enhancement' }];

    before(async () => {
      scope = nock('https://api.github.com')
        .get('/repos/owner/repo/labels')
        .reply(200, LABELS);

      result = await github.getRepositoryLabels();
    });

    after(nock.cleanAll);

    it('fetches repository labels', () => {
      expect(scope.isDone()).to.be.true;
    });

    it('returns the repository labels', () => {
      expect(result).to.deep.equal(LABELS);
    });
  });

  describe('#createLabel', () => {
    let scope;
    const LABEL = { name: 'new_label', color: 'ffffff' };

    before(async () => {
      scope = nock('https://api.github.com')
        .post('/repos/owner/repo/labels', body => body.name === LABEL.name)
        .reply(200, LABEL);

      await github.createLabel(LABEL);
    });

    after(nock.cleanAll);

    it('creates the new label', () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#createIssue', () => {
    let scope;
    let result;
    const ISSUE = {
      title: 'New Issue',
      description: 'Description of the new issue',
      labels: ['bug'],
    };
    const CREATED_ISSUE = { number: 123, ...ISSUE };

    before(async () => {
      scope = nock('https://api.github.com')
        .post('/repos/owner/repo/issues', request => request.title === ISSUE.title && request.body === ISSUE.description && request.labels[0] === ISSUE.labels[0])
        .reply(200, CREATED_ISSUE);

      result = await github.createIssue(ISSUE);
    });

    after(nock.cleanAll);

    it('creates the new issue', () => {
      expect(scope.isDone()).to.be.true;
    });

    it('returns the created issue', () => {
      expect(result).to.deep.equal(CREATED_ISSUE);
    });
  });

  describe('#setIssueLabels', () => {
    let scope;
    const ISSUE_NUMBER = 123;
    const LABELS = [ 'bug', 'enhancement' ];

    before(async () => {
      scope = nock('https://api.github.com')
        .put(`/repos/owner/repo/issues/${ISSUE_NUMBER}/labels`, { labels: LABELS })
        .reply(200);

      await github.setIssueLabels({ issue: { number: ISSUE_NUMBER }, labels: LABELS });
    });

    after(nock.cleanAll);

    it('sets labels on the issue', () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#openIssue', () => {
    let scope;
    const ISSUE = { number: 123 };
    const EXPECTED_REQUEST_BODY = { state: 'open' };

    before(async () => {
      scope = nock('https://api.github.com')
        .patch(`/repos/owner/repo/issues/${ISSUE.number}`, EXPECTED_REQUEST_BODY)
        .reply(200);

      await github.openIssue(ISSUE);
    });

    after(nock.cleanAll);

    it('opens the issue', () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#closeIssue', () => {
    let scope;
    const ISSUE = { number: 123 };
    const EXPECTED_REQUEST_BODY = { state: 'closed' };

    before(async () => {
      scope = nock('https://api.github.com')
        .patch(`/repos/owner/repo/issues/${ISSUE.number}`, EXPECTED_REQUEST_BODY)
        .reply(200);

      await github.closeIssue(ISSUE);
    });

    after(nock.cleanAll);

    it('closes the issue', () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#getIssue', () => {
    let scope;
    let result;

    const ISSUE = { number: 123, title: 'Test Issue' };
    const ANOTHER_ISSUE = { number: 124, title: 'Test Issue 2' };

    before(async () => {
      scope = nock('https://api.github.com')
        .get('/repos/owner/repo/issues')
        .query(true)
        .reply(200, [ ISSUE, ANOTHER_ISSUE ]);

      result = await github.getIssue({ title: ISSUE.title });
    });

    after(nock.cleanAll);

    it('searches for the issue', () => {
      expect(scope.isDone()).to.be.true;
    });

    it('returns the expected issue', () => {
      expect(result).to.deep.equal(ISSUE);
    });
  });

  describe('#addCommentToIssue', () => {
    let scope;
    const ISSUE_NUMBER = 123;
    const COMMENT = 'Test comment';

    before(async () => {
      scope = nock('https://api.github.com')
        .post(`/repos/owner/repo/issues/${ISSUE_NUMBER}/comments`, { body: COMMENT })
        .reply(200);

      await github.addCommentToIssue({ issue: { number: ISSUE_NUMBER }, comment: COMMENT });
    });

    after(nock.cleanAll);

    it('adds the comment to the issue', () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#closeIssueWithCommentIfExists', () => {
    after(nock.cleanAll);

    context('when the issue exists and is open', () => {
      const ISSUE = {
        number: 123,
        title: 'Open Issue',
        state: GitHub.ISSUE_STATE_OPEN,
      };
      let addCommentScope;
      let closeIssueScope;

      before(async () => {
        nock('https://api.github.com')
          .get('/repos/owner/repo/issues')
          .query(true)
          .reply(200, [ISSUE]);

        addCommentScope = nock('https://api.github.com')
          .post(`/repos/owner/repo/issues/${ISSUE.number}/comments`)
          .reply(200);

        closeIssueScope = nock('https://api.github.com')
          .patch(`/repos/owner/repo/issues/${ISSUE.number}`, { state: GitHub.ISSUE_STATE_CLOSED })
          .reply(200);

        await github.closeIssueWithCommentIfExists({ title: ISSUE.title, comment: 'Closing comment' });
      });

      it('adds comment to the issue', () => {
        expect(addCommentScope.isDone()).to.be.true;
      });

      it('closes the issue', () => {
        expect(closeIssueScope.isDone()).to.be.true;
      });
    });

    context('when the issue exists and is closed', () => {
      const ISSUE = {
        number: 123,
        title: 'Closed Issue',
        state: GitHub.ISSUE_STATE_CLOSED,
      };
      let addCommentScope;
      let closeIssueScope;

      before(async () => {
        nock('https://api.github.com')
          .get('/repos/owner/repo/issues')
          .query(true)
          .reply(200, []);

        addCommentScope = nock('https://api.github.com')
          .post(`/repos/owner/repo/issues/${ISSUE.number}/comments`)
          .reply(200);

        closeIssueScope = nock('https://api.github.com')
          .patch(`/repos/owner/repo/issues/${ISSUE.number}`, { state: GitHub.ISSUE_STATE_CLOSED })
          .reply(200);

        await github.closeIssueWithCommentIfExists({ title: ISSUE.title, comment: 'Closing comment' });
      });

      it('does not add comment', () => {
        expect(addCommentScope.isDone()).to.be.false;
      });

      it('does not attempt to close the issue', () => {
        expect(closeIssueScope.isDone()).to.be.false;
      });
    });

    context('when the issue does not exist', () => {
      let addCommentScope;
      let closeIssueScope;

      before(async () => {
        nock('https://api.github.com')
          .get('/repos/owner/repo/issues')
          .query(true)
          .reply(200, []);

        addCommentScope = nock('https://api.github.com')
          .post(/\/repos\/owner\/repo\/issues\/\d+\/comments/)
          .reply(200);

        closeIssueScope = nock('https://api.github.com')
          .patch(/\/repos\/owner\/repo\/issues\/\d+/, { state: GitHub.ISSUE_STATE_CLOSED })
          .reply(200);

        await github.closeIssueWithCommentIfExists({ title: 'Non-existent Issue', comment: 'Closing comment' });
      });

      it('does not attempt to add comment', () => {
        expect(addCommentScope.isDone()).to.be.false;
      });

      it('does not attempt to close the issue', () => {
        expect(closeIssueScope.isDone()).to.be.false;
      });
    });
  });

  describe('#createOrUpdateIssue', () => {
    before(async () => {
      nock('https://api.github.com')
        .get('/repos/owner/repo/labels')
        .reply(200, MANAGED_LABELS);

      await github.initialize();
    });

    context('when the issue does not exist', () => {
      let createIssueScope;
      const ISSUE_TO_CREATE = {
        title: 'New Issue',
        description: 'Description of the new issue',
        label: 'bug',
      };

      before(async () => {
        nock('https://api.github.com')
          .get('/repos/owner/repo/issues')
          .query(true)
          .reply(200, []); // Simulate that there is no issues on the repository

        createIssueScope = nock('https://api.github.com')
          .post('/repos/owner/repo/issues', {
            title: ISSUE_TO_CREATE.title,
            body: ISSUE_TO_CREATE.description,
            labels: [ISSUE_TO_CREATE.label],
          })
          .reply(200, { number: 123 });

        await github.createOrUpdateIssue(ISSUE_TO_CREATE);
      });

      it('creates the issue', () => {
        expect(createIssueScope.isDone()).to.be.true;
      });
    });

    context('when the issue already exists', () => {
      const ISSUE = {
        title: 'Existing Issue',
        description: 'New comment',
        label: 'location',
      };

      context('when issue is closed', () => {
        let setIssueLabelsScope;
        let addCommentScope;
        let openIssueScope;

        const GITHUB_RESPONSE_FOR_EXISTING_ISSUE = {
          number: 123,
          title: ISSUE.title,
          description: ISSUE.description,
          labels: [{ name: 'selectors' }],
          state: GitHub.ISSUE_STATE_CLOSED,
        };

        before(async () => {
          nock('https://api.github.com')
            .get('/repos/owner/repo/issues')
            .query(true)
            .reply(200, [GITHUB_RESPONSE_FOR_EXISTING_ISSUE]);

          openIssueScope = nock('https://api.github.com')
            .patch(`/repos/owner/repo/issues/${GITHUB_RESPONSE_FOR_EXISTING_ISSUE.number}`, { state: GitHub.ISSUE_STATE_OPEN })
            .reply(200);

          setIssueLabelsScope = nock('https://api.github.com')
            .put(`/repos/owner/repo/issues/${GITHUB_RESPONSE_FOR_EXISTING_ISSUE.number}/labels`, { labels: ['location'] })
            .reply(200);

          addCommentScope = nock('https://api.github.com')
            .post(`/repos/owner/repo/issues/${GITHUB_RESPONSE_FOR_EXISTING_ISSUE.number}/comments`, { body: ISSUE.description })
            .reply(200);

          await github.createOrUpdateIssue(ISSUE);
        });

        it('reopens the issue', () => {
          expect(openIssueScope.isDone()).to.be.true;
        });

        it("updates the issue's label", () => {
          expect(setIssueLabelsScope.isDone()).to.be.true;
        });

        it('adds comment to the issue', () => {
          expect(addCommentScope.isDone()).to.be.true;
        });
      });

      context('when issue is already opened', () => {
        let setIssueLabelsScope;
        let addCommentScope;
        let openIssueScope;

        const GITHUB_RESPONSE_FOR_EXISTING_ISSUE = {
          number: 123,
          title: ISSUE.title,
          description: ISSUE.description,
          labels: [{ name: 'selectors' }],
          state: GitHub.ISSUE_STATE_OPEN,
        };

        before(async () => {
          nock('https://api.github.com')
            .get('/repos/owner/repo/issues')
            .query(true)
            .reply(200, [GITHUB_RESPONSE_FOR_EXISTING_ISSUE]);

          openIssueScope = nock('https://api.github.com')
            .patch(`/repos/owner/repo/issues/${GITHUB_RESPONSE_FOR_EXISTING_ISSUE.number}`, { state: GitHub.ISSUE_STATE_OPEN })
            .reply(200);

          setIssueLabelsScope = nock('https://api.github.com')
            .put(`/repos/owner/repo/issues/${GITHUB_RESPONSE_FOR_EXISTING_ISSUE.number}/labels`, { labels: ['location'] })
            .reply(200);

          addCommentScope = nock('https://api.github.com')
            .post(`/repos/owner/repo/issues/${GITHUB_RESPONSE_FOR_EXISTING_ISSUE.number}/comments`, { body: ISSUE.description })
            .reply(200);

          await github.createOrUpdateIssue(ISSUE);
        });

        it('does not change the issue state', () => {
          expect(openIssueScope.isDone()).to.be.false;
        });

        it("updates the issue's label", () => {
          expect(setIssueLabelsScope.isDone()).to.be.true;
        });

        it('adds comment to the issue', () => {
          expect(addCommentScope.isDone()).to.be.true;
        });
      });
    });
  });
});
