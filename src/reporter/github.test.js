import { createRequire } from 'module';

import { expect } from 'chai';
import nock from 'nock';

import GitHub from './github.js';

const require = createRequire(import.meta.url);

describe('GitHub', function () {
  this.timeout(5000);

  let github;
  const MANAGED_LABELS = require('./labels.json');

  before(() => {
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

    it('should create missing labels', async () => {
      scopes.forEach(scope => expect(scope.isDone()).to.be.true);
    });
  });

  describe('#getRepositoryLabels', () => {
    let scope;
    let result;
    let labels;

    before(async () => {
      labels = [{ name: 'bug' }, { name: 'enhancement' }];

      scope = nock('https://api.github.com')
        .get('/repos/owner/repo/labels')
        .reply(200, labels);

      result = await github.getRepositoryLabels();
    });

    after(nock.cleanAll);

    it('fetches repository labels', async () => {
      expect(scope.isDone()).to.be.true;
    });

    it('returns the repository labels', async () => {
      expect(result).to.deep.equal(labels);
    });
  });

  describe('#createLabel', () => {
    let scope;

    before(async () => {
      const label = { name: 'new_label', color: 'ffffff' };

      scope = nock('https://api.github.com')
        .post('/repos/owner/repo/labels', body => body.name === label.name)
        .reply(200, label);

      await github.createLabel(label);
    });

    after(nock.cleanAll);

    it('creates the new label', async () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#createIssue', () => {
    let scope;
    let createdIssue;
    let result;

    before(async () => {
      const newIssue = {
        title: 'New Issue',
        description: 'Description of the new issue',
        labels: ['bug'],
      };

      createdIssue = { number: 123, ...newIssue };

      scope = nock('https://api.github.com')
        .post('/repos/owner/repo/issues', body => body.title === newIssue.title && body.body === newIssue.description && body.labels[0] === newIssue.labels[0])
        .reply(200, createdIssue);

      result = await github.createIssue(newIssue);
    });

    after(nock.cleanAll);

    it('creates the new issue', async () => {
      expect(scope.isDone()).to.be.true;
    });

    it('returns the created issue', async () => {
      expect(result).to.deep.equal(createdIssue);
    });
  });

  describe('#setIssueLabels', () => {
    let scope;

    before(async () => {
      const issueNumber = 123;
      const labels = [ 'bug', 'enhancement' ];

      scope = nock('https://api.github.com')
        .put(`/repos/owner/repo/issues/${issueNumber}/labels`, { labels })
        .reply(200);

      await github.setIssueLabels({ issue: { number: issueNumber }, labels });
    });

    after(nock.cleanAll);

    it('sets labels on the issue', async () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#openIssue', () => {
    let scope;

    before(async () => {
      const issue = { number: 123 };
      const expectedRequestBody = { state: 'open' };

      scope = nock('https://api.github.com')
        .patch(`/repos/owner/repo/issues/${issue.number}`, expectedRequestBody)
        .reply(200);

      await github.openIssue(issue);
    });

    after(nock.cleanAll);

    it('opens the issue', async () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#closeIssue', () => {
    let scope;

    before(async () => {
      const issue = { number: 123 };
      const expectedRequestBody = { state: 'closed' };

      scope = nock('https://api.github.com')
        .patch(`/repos/owner/repo/issues/${issue.number}`, expectedRequestBody)
        .reply(200);

      await github.closeIssue(issue);
    });

    after(nock.cleanAll);

    it('closes the issue', async () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#getIssue', () => {
    let scope;
    let issue;
    let result;

    before(async () => {
      issue = { number: 123, title: 'Test Issue' };
      const anotherIssue = { number: 124, title: 'Test Issue 2' };

      scope = nock('https://api.github.com')
        .get('/repos/owner/repo/issues')
        .query(true)
        .reply(200, [ issue, anotherIssue ]);

      result = await github.getIssue({ title: 'Test Issue' });
    });

    after(nock.cleanAll);

    it('searches for the issue', () => {
      expect(scope.isDone()).to.be.true;
    });

    it('returns the expected issue', async () => {
      expect(result).to.deep.equal(issue);
    });
  });

  describe('#addCommentToIssue', () => {
    let scope;

    before(async () => {
      const issueNumber = 123;
      const comment = 'Test comment';

      scope = nock('https://api.github.com')
        .post(`/repos/owner/repo/issues/${issueNumber}/comments`, { body: comment })
        .reply(200);

      await github.addCommentToIssue({ issue: { number: issueNumber }, comment });
    });

    after(nock.cleanAll);

    it('adds the comment to the issue', async () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#closeIssueWithCommentIfExists', () => {
    after(nock.cleanAll);

    context('when the issue exists and is open', () => {
      let issue;
      let getIssuesScope;
      let addCommentScope;
      let closeIssueScope;

      before(async () => {
        issue = { number: 123, title: 'Open Issue', state: GitHub.ISSUE_STATE_OPEN };

        getIssuesScope = nock('https://api.github.com')
          .get('/repos/owner/repo/issues')
          .query(true)
          .reply(200, [issue]);

        addCommentScope = nock('https://api.github.com')
          .post(`/repos/owner/repo/issues/${issue.number}/comments`)
          .reply(200);

        closeIssueScope = nock('https://api.github.com')
          .patch(`/repos/owner/repo/issues/${issue.number}`, { state: GitHub.ISSUE_STATE_CLOSED })
          .reply(200);

        await github.closeIssueWithCommentIfExists({ title: issue.title, comment: 'Closing comment' });
      });

      it('searches for the issue', () => {
        expect(getIssuesScope.isDone()).to.be.true;
      });

      it('adds comment to the issue', () => {
        expect(addCommentScope.isDone()).to.be.true;
      });

      it('closes the issue', () => {
        expect(closeIssueScope.isDone()).to.be.true;
      });
    });

    context('when the issue exists and is closed', () => {
      let issue;
      let getIssuesScope;
      let addCommentScope;
      let closeIssueScope;

      before(async () => {
        issue = { number: 123, title: 'Closed Issue', state: GitHub.ISSUE_STATE_CLOSED };

        getIssuesScope = nock('https://api.github.com')
          .get('/repos/owner/repo/issues')
          .query(true)
          .reply(200, []);

        addCommentScope = nock('https://api.github.com')
          .post(`/repos/owner/repo/issues/${issue.number}/comments`)
          .reply(200);

        closeIssueScope = nock('https://api.github.com')
          .patch(`/repos/owner/repo/issues/${issue.number}`, { state: GitHub.ISSUE_STATE_CLOSED })
          .reply(200);

        await github.closeIssueWithCommentIfExists({ title: issue.title, comment: 'Closing comment' });
      });

      it('searches for the issue', () => {
        expect(getIssuesScope.isDone()).to.be.true;
      });

      it('does not attempt to add comment', () => {
        expect(addCommentScope.isDone()).to.be.false;
      });

      it('does not attempt to close the issue', () => {
        expect(closeIssueScope.isDone()).to.be.false;
      });
    });

    context('when the issue does not exist', () => {
      let issue;
      let getIssuesScope;
      let addCommentScope;
      let closeIssueScope;

      before(async () => {
        issue = { number: 123, title: 'Non-existent Issue', state: GitHub.ISSUE_STATE_CLOSED };

        getIssuesScope = nock('https://api.github.com')
          .get('/repos/owner/repo/issues')
          .query(true)
          .reply(200, []);

        addCommentScope = nock('https://api.github.com')
          .post(`/repos/owner/repo/issues/${issue.number}/comments`)
          .reply(200);

        closeIssueScope = nock('https://api.github.com')
          .patch(`/repos/owner/repo/issues/${issue.number}`, { state: GitHub.ISSUE_STATE_CLOSED })
          .reply(200);

        await github.closeIssueWithCommentIfExists({ title: issue.title, comment: 'Closing comment' });
      });

      it('searches for the issue', () => {
        expect(getIssuesScope.isDone()).to.be.true;
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

    after(nock.cleanAll);

    context('when the issue does not exist', () => {
      let getIssuesScope;
      let createIssueScope;

      before(async () => {
        const newIssue = {
          title: 'New Issue',
          description: 'Description of the new issue',
          label: 'bug',
        };

        getIssuesScope = nock('https://api.github.com')
          .get('/repos/owner/repo/issues')
          .query(true)
          .reply(200, []); // Simulate that there is no issues on the repository

        createIssueScope = nock('https://api.github.com')
          .post('/repos/owner/repo/issues', {
            title: newIssue.title,
            body: newIssue.description,
            labels: [newIssue.label],
          })
          .reply(200, { number: 123 });

        await github.createOrUpdateIssue(newIssue);
      });

      it('searches for the issue', () => {
        expect(getIssuesScope.isDone()).to.be.true;
      });

      it('creates the issue', async () => {
        expect(createIssueScope.isDone()).to.be.true;
      });
    });

    context('when the issue already exists', () => {
      context('when issue is closed', () => {
        let setIssueLabelsScope;
        let addCommentScope;
        let openIssueScope;
        let getIssuesScope;

        before(async () => {
          const issue = {
            title: 'Existing Issue',
            description: 'New comment',
            label: 'location',
          };

          const githubResponseForExistingIssue = {
            number: 123,
            title: issue.title,
            description: issue.description,
            labels: [{ name: 'selectors' }],
            state: GitHub.ISSUE_STATE_CLOSED,
          };

          getIssuesScope = nock('https://api.github.com')
            .get('/repos/owner/repo/issues')
            .query(true)
            .reply(200, [githubResponseForExistingIssue]);

          openIssueScope = nock('https://api.github.com')
            .patch(`/repos/owner/repo/issues/${githubResponseForExistingIssue.number}`, { state: GitHub.ISSUE_STATE_OPEN })
            .reply(200);

          setIssueLabelsScope = nock('https://api.github.com')
            .put(`/repos/owner/repo/issues/${githubResponseForExistingIssue.number}/labels`, { labels: ['location'] })
            .reply(200);

          addCommentScope = nock('https://api.github.com')
            .post(`/repos/owner/repo/issues/${githubResponseForExistingIssue.number}/comments`, { body: issue.description })
            .reply(200);

          await github.createOrUpdateIssue(issue);
        });

        it('searches for the issue', () => {
          expect(getIssuesScope.isDone()).to.be.true;
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
        let getIssuesScope;

        before(async () => {
          const issue = {
            title: 'Existing Issue',
            description: 'New comment',
            label: 'location',
          };

          const githubResponseForExistingIssue = {
            number: 123,
            title: issue.title,
            description: issue.description,
            labels: [{ name: 'selectors' }],
            state: GitHub.ISSUE_STATE_OPEN,
          };

          getIssuesScope = nock('https://api.github.com')
            .get('/repos/owner/repo/issues')
            .query(true)
            .reply(200, [githubResponseForExistingIssue]);

          openIssueScope = nock('https://api.github.com')
            .patch(`/repos/owner/repo/issues/${githubResponseForExistingIssue.number}`, { state: GitHub.ISSUE_STATE_OPEN })
            .reply(200);

          setIssueLabelsScope = nock('https://api.github.com')
            .put(`/repos/owner/repo/issues/${githubResponseForExistingIssue.number}/labels`, { labels: ['location'] })
            .reply(200);

          addCommentScope = nock('https://api.github.com')
            .post(`/repos/owner/repo/issues/${githubResponseForExistingIssue.number}/comments`, { body: issue.description })
            .reply(200);

          await github.createOrUpdateIssue(issue);
        });

        it('searches for the issue', () => {
          expect(getIssuesScope.isDone()).to.be.true;
        });

        it('does not attempt to change the issue state', () => {
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
