import { createRequire } from 'module';

import { expect } from 'chai';
import nock from 'nock';

import GitHub from './github.js';

const require = createRequire(import.meta.url);

describe('GitHub', function () {
  this.timeout(5000);

  let MANAGED_LABELS;
  let github;
  const EXISTING_OPEN_ISSUE = { number: 1, title: 'Opened issue', description: 'Issue description', state: GitHub.ISSUE_STATE_OPEN, labels: [{ name: 'location' }] };
  const EXISTING_CLOSED_ISSUE = { number: 2, title: 'Closed issue', description: 'Issue description', state: GitHub.ISSUE_STATE_CLOSED, labels: [{ name: '403' }] };

  before(async () => {
    MANAGED_LABELS = require('./labels.json');
    github = new GitHub('owner/repo');
    nock('https://api.github.com')
      .get('/repos/owner/repo/issues')
      .query(true)
      .reply(200, [ EXISTING_OPEN_ISSUE, EXISTING_CLOSED_ISSUE ]);
    await github.refreshIssuesCache();
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
    const LABEL = { name: 'new_label', color: 'ffffff' };

    afterEach(nock.cleanAll);

    it('creates the new label successfully', async () => {
      const scope = nock('https://api.github.com')
        .post('/repos/owner/repo/labels', body => body.name === LABEL.name)
        .reply(200, LABEL);

      await github.createLabel(LABEL);
      expect(scope.isDone()).to.be.true;
    });

    it('throws error when creating label fails', async () => {
      nock('https://api.github.com')
        .post('/repos/owner/repo/labels')
        .reply(400, { message: 'Bad Request' });

      await expect(github.createLabel(LABEL)).to.be.rejected;
    });
  });

  describe('#createIssue', () => {
    let scope;
    let result;

    const ISSUE = {
      title: 'New Issue',
      description: 'Description of the new issue',
      labels: [{ name: 'bug' }],
    };
    const CREATED_ISSUE = { number: 123, ...ISSUE };

    before(async () => {
      scope = nock('https://api.github.com')
        .post('/repos/owner/repo/issues', request =>
          request.title === ISSUE.title && request.body === ISSUE.description && request.labels[0].name === ISSUE.labels[0].name)
        .reply(200, CREATED_ISSUE);

      result = await github.createIssue(ISSUE);
    });

    after(() => {
      nock.cleanAll();
      github.issuesCache.delete(ISSUE.title);
    });

    it('creates the new issue', () => {
      expect(scope.isDone()).to.be.true;
    });

    it('returns the newly created issue', () => {
      expect(result).to.deep.equal(CREATED_ISSUE);
    });

    it('throws error when creating issue fails', async () => {
      nock('https://api.github.com')
        .post('/repos/owner/repo/issues')
        .reply(400, { message: 'Bad Request' });

      await expect(github.createIssue(ISSUE)).to.be.rejected;
    });
  });

  describe('#getIssue', () => {
    context('when the issue exists in the cache', () => {
      it('returns the cached issue', () => {
        expect(github.getIssue(EXISTING_OPEN_ISSUE.title)).to.deep.equal(EXISTING_OPEN_ISSUE);
      });
    });

    context('when the issue does not exist in the cache', () => {
      it('returns null', () => {
        expect(github.getIssue('Non-existent Issue')).to.be.null;
      });
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

    it('throws error when adding comment fails', async () => {
      nock('https://api.github.com')
        .post(`/repos/owner/repo/issues/${ISSUE_NUMBER}/comments`)
        .reply(400, { message: 'Bad Request' });

      await expect(github.addCommentToIssue({ issue: { number: ISSUE_NUMBER }, comment: COMMENT })).to.be.rejected;
    });
  });

  describe('#closeIssueWithCommentIfExists', () => {
    after(nock.cleanAll);

    context('when the issue exists and is open', () => {
      let addCommentScope;
      let closeIssueScope;

      before(async () => {
        addCommentScope = nock('https://api.github.com')
          .post(`/repos/owner/repo/issues/${EXISTING_OPEN_ISSUE.number}/comments`)
          .reply(200);

        closeIssueScope = nock('https://api.github.com')
          .patch(`/repos/owner/repo/issues/${EXISTING_OPEN_ISSUE.number}`, { state: GitHub.ISSUE_STATE_CLOSED })
          .reply(200);

        await github.closeIssueWithCommentIfExists({ title: EXISTING_OPEN_ISSUE.title, comment: 'Closing comment' });
      });

      it('adds comment to the issue', () => {
        expect(addCommentScope.isDone()).to.be.true;
      });

      it('closes the issue', () => {
        expect(closeIssueScope.isDone()).to.be.true;
      });
    });

    context('when the issue exists and is closed', () => {
      let addCommentScope;
      let closeIssueScope;

      before(async () => {
        addCommentScope = nock('https://api.github.com')
          .post(`/repos/owner/repo/issues/${EXISTING_CLOSED_ISSUE.number}/comments`)
          .reply(200);

        closeIssueScope = nock('https://api.github.com')
          .patch(`/repos/owner/repo/issues/${EXISTING_CLOSED_ISSUE.number}`, { state: GitHub.ISSUE_STATE_CLOSED })
          .reply(200);

        await github.closeIssueWithCommentIfExists({ title: EXISTING_CLOSED_ISSUE.title, comment: 'Closing comment' });
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
      github.MANAGED_LABELS = require('./labels.json');
    });

    context('when the issue does not exist', () => {
      let createIssueScope;
      const ISSUE_TO_CREATE = {
        title: 'New Issue',
        description: 'Description of the new issue',
        label: 'bug',
      };

      before(async () => {
        createIssueScope = nock('https://api.github.com')
          .post('/repos/owner/repo/issues', {
            title: ISSUE_TO_CREATE.title,
            body: ISSUE_TO_CREATE.description,
            labels: [ISSUE_TO_CREATE.label],
          })
          .reply(200, { number: 123 });

        await github.createOrUpdateIssue(ISSUE_TO_CREATE);
      });

      afterEach(() => {
        github.issuesCache.delete(ISSUE_TO_CREATE.title);
      });

      it('creates the issue', () => {
        expect(createIssueScope.isDone()).to.be.true;
      });
    });

    context('when the issue already exists', () => {
      context('when issue is closed', () => {
        let updateIssueScope;
        let addCommentScope;

        before(async () => {
          updateIssueScope = nock('https://api.github.com')
            .patch(`/repos/owner/repo/issues/${EXISTING_CLOSED_ISSUE.number}`, { state: GitHub.ISSUE_STATE_OPEN, labels: ['location'] })
            .reply(200);

          addCommentScope = nock('https://api.github.com')
            .post(`/repos/owner/repo/issues/${EXISTING_CLOSED_ISSUE.number}/comments`, { body: EXISTING_CLOSED_ISSUE.description })
            .reply(200);

          await github.createOrUpdateIssue({ title: EXISTING_CLOSED_ISSUE.title, description: EXISTING_CLOSED_ISSUE.description, label: 'location' });
        });

        after(() => {
          github.issuesCache.delete(EXISTING_CLOSED_ISSUE);
          github.issuesCache.set(EXISTING_CLOSED_ISSUE.title, EXISTING_CLOSED_ISSUE);
        });

        it('reopens the issue and updates its labels', () => {
          expect(updateIssueScope.isDone()).to.be.true;
        });

        it('adds comment to the issue', () => {
          expect(addCommentScope.isDone()).to.be.true;
        });
      });

      context('when issue is already opened', () => {
        context('when the reason is new', () => {
          let addCommentScope;
          let updateIssueScope;

          before(async () => {
            updateIssueScope = nock('https://api.github.com')
              .patch(`/repos/owner/repo/issues/${EXISTING_OPEN_ISSUE.number}`, { state: GitHub.ISSUE_STATE_OPEN, labels: ['404'] })
              .reply(200);

            addCommentScope = nock('https://api.github.com')
              .post(`/repos/owner/repo/issues/${EXISTING_OPEN_ISSUE.number}/comments`, { body: EXISTING_OPEN_ISSUE.description })
              .reply(200);

            await github.createOrUpdateIssue({ title: EXISTING_OPEN_ISSUE.title, description: EXISTING_OPEN_ISSUE.description, label: '404' });
          });

          after(() => {
            github.issuesCache.delete(EXISTING_OPEN_ISSUE.title);
            github.issuesCache.set(EXISTING_OPEN_ISSUE.title, EXISTING_OPEN_ISSUE);
          });

          it("updates the issue's labels", () => {
            expect(updateIssueScope.isDone()).to.be.true;
          });

          it('adds comment to the issue', () => {
            expect(addCommentScope.isDone()).to.be.true;
          });
        });
        context('when the reason unchanged', () => {
          let addCommentScope;
          let updateIssueScope;

          before(async () => {
            updateIssueScope = nock('https://api.github.com')
              .patch(`/repos/owner/repo/issues/${EXISTING_OPEN_ISSUE.number}`, { state: GitHub.ISSUE_STATE_OPEN, labels: EXISTING_OPEN_ISSUE.labels })
              .reply(200);

            addCommentScope = nock('https://api.github.com')
              .post(`/repos/owner/repo/issues/${EXISTING_OPEN_ISSUE.number}/comments`, { body: EXISTING_OPEN_ISSUE.description })
              .reply(200);

            await github.createOrUpdateIssue({ title: EXISTING_OPEN_ISSUE.title, description: EXISTING_OPEN_ISSUE.description, label: EXISTING_OPEN_ISSUE.labels[0].name });
          });

          after(() => {
            github.issuesCache.delete(EXISTING_OPEN_ISSUE.title);
            github.issuesCache.set(EXISTING_OPEN_ISSUE.title, EXISTING_OPEN_ISSUE);
          });

          it("does not attempt to updates the issue's labels", () => {
            expect(updateIssueScope.isDone()).to.be.false;
          });

          it('does not attempt to add comment to the issue', () => {
            expect(addCommentScope.isDone()).to.be.false;
          });
        });
      });
    });
  });
});
