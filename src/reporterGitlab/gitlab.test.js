import { createRequire } from 'module';

import { expect } from 'chai';
import nock from 'nock';

import GitLab from './gitlab.js';

const require = createRequire(import.meta.url);

describe('GitLab', function () {
  this.timeout(5000);

  let MANAGED_LABELS;
  let gitlab;
  let gitlabApiUrl = '';
  let reqHeaders;
  const projectId = '4';

  before(() => {
    MANAGED_LABELS = require('./labels.json');
    gitlab = new GitLab('owner/repo');
    gitlab.projectId = projectId;
    gitlabApiUrl = gitlab.gitlabUrl;
    reqHeaders = { reqheaders: { Authorization: `Bearer ${process.env.OTA_ENGINE_GITLAB_TOKEN}` } };
  });

  describe('#Gitlab_initialize', () => {
    const scopes = [];

    before(async () => {
      const existingLabels = MANAGED_LABELS.slice(0, -2);

      nock(gitlabApiUrl, reqHeaders)
        .get(`/projects/${encodeURIComponent('owner/repo')}`)
        .reply(200, { id: 4 });

      nock(gitlabApiUrl, reqHeaders)
        .get(`/projects/${projectId}/labels?with_counts=true`)
        .reply(200, existingLabels);

      const missingLabels = MANAGED_LABELS.slice(-2);

      for (const label of missingLabels) {
        scopes.push(nock(gitlabApiUrl, reqHeaders)
          .post(`/projects/${projectId}/labels`)
          .reply(200, { name: label.name }));
      }

      await gitlab.initialize();
    });

    after(nock.cleanAll);

    it('should create missing labels', () => {
      scopes.forEach(scope => expect(scope.isDone()).to.be.true);
    });
  });

  describe('#Gitlab_getRepositoryLabels', () => {
    let scope;
    let result;
    const LABELS = [{ name: 'bug' }, { name: 'enhancement' }];

    before(async () => {
      scope = nock(gitlabApiUrl, reqHeaders)
        .get(`/projects/${projectId}/labels?with_counts=true`)
        .reply(200, LABELS);

      result = await gitlab.getRepositoryLabels();
    });

    after(nock.cleanAll);

    it('fetches repository labels', () => {
      expect(scope.isDone()).to.be.true;
    });

    it('returns the repository labels', () => {
      expect(result).to.deep.equal(LABELS);
    });
  });

  describe('#Gitlab_createLabel', () => {
    let scope;
    const LABEL = { name: 'new_label', color: 'ffffff' };

    before(async () => {
      scope = nock(gitlabApiUrl, reqHeaders)
        .post(`/projects/${projectId}/labels`, body => body.name === LABEL.name)
        .reply(200, LABEL);

      await gitlab.createLabel(LABEL);
    });

    after(nock.cleanAll);

    it('creates the new label', () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#Gitlab_createIssue', () => {
    let scope;
    let result;

    const ISSUE = {
      title: 'New Issue',
      description: 'Description of the new issue',
      labels: ['bug'],
    };
    const CREATED_ISSUE = {
      title: 'New Issue',
      description: 'Description of the new issue',
      labels: ['bug'],
      iid: 555,
      web_url: 'https://example.com/test/test',
    };

    before(async () => {
      scope = nock(gitlabApiUrl, reqHeaders)
        .post(`/projects/${projectId}/issues`)
        .reply(200, CREATED_ISSUE);

      result = await gitlab.createIssue(ISSUE);
    });

    after(nock.cleanAll);

    it('creates the new issue', () => {
      expect(scope.isDone()).to.be.true;
    });

    it('returns the created issue', () => {
      expect(result).to.deep.equal(CREATED_ISSUE);
    });
  });

  describe('#Gitlab_setIssueLabels', () => {
    let scope;
    const issue = {
      iid: 123,
      title: 'test issue',
    };
    const labels = [ 'bug', 'enhancement' ];

    const response = {
      iid: 123,
      labels,
    };

    before(async () => {
      scope = nock(gitlabApiUrl, reqHeaders)
        .put(`/projects/${projectId}/issues/${issue.iid}`, { labels })
        .reply(200, response);

      await gitlab.setIssueLabels({ issue, labels });
    });

    after(nock.cleanAll);

    it('sets labels on the issue', () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#Gitlab_openIssue', () => {
    let scope;
    const ISSUE = { iid: 123, title: 'issue reopened' };
    const EXPECTED_REQUEST_BODY = { state_event: 'reopen' };
    const response = { iid: 123 };

    before(async () => {
      scope = nock(gitlabApiUrl, reqHeaders)
        .put(`/projects/${projectId}/issues/${ISSUE.iid}`, EXPECTED_REQUEST_BODY)
        .reply(200, response);

      await gitlab.openIssue(ISSUE);
    });

    after(nock.cleanAll);

    it('opens the issue', () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#Gitlab_closeIssue', () => {
    let scope;
    const ISSUE = { iid: 123, title: 'close issue' };
    const EXPECTED_REQUEST_BODY = { state_event: 'close' };
    const response = { iid: 123 };

    before(async () => {
      scope = nock(gitlabApiUrl, reqHeaders)
        .put(`/projects/${projectId}/issues/${ISSUE.iid}`, EXPECTED_REQUEST_BODY)
        .reply(200, response);

      await gitlab.closeIssue(ISSUE);
    });

    after(nock.cleanAll);

    it('closes the issue', () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#Gitlab_getIssue', () => {
    let scope;
    let result;

    const ISSUE = { number: 123, title: 'Test Issue' };
    const ANOTHER_ISSUE = { number: 124, title: 'Test Issue 2' };

    before(async () => {
      scope = nock(gitlabApiUrl, reqHeaders)
        .get(`/projects/${projectId}/issues?search=${encodeURIComponent(ISSUE.title)}&per_page=100`)
        .reply(200, [ ISSUE, ANOTHER_ISSUE ]);

      result = await gitlab.getIssue({ title: ISSUE.title });
    });

    after(nock.cleanAll);

    it('searches for the issue', () => {
      expect(scope.isDone()).to.be.true;
    });

    it('returns the expected issue', () => {
      expect(result).to.deep.equal(ISSUE);
    });
  });

  describe('#Gitlab_addCommentToIssue', () => {
    let scope;
    const ISSUE = { iid: 123, title: 'Test Issue' };
    const COMMENT = 'Test comment';
    const response = { iid: 123, id: 23, body: 'Test comment' };

    before(async () => {
      scope = nock(gitlabApiUrl, reqHeaders)
        .post(`/projects/${projectId}/issues/${ISSUE.iid}/notes`, { body: COMMENT })
        .reply(200, response);

      await gitlab.addCommentToIssue({ issue: ISSUE, comment: COMMENT });
    });

    after(nock.cleanAll);

    it('adds the comment to the issue', () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#Gitlab_closeIssueWithCommentIfExists', () => {
    after(nock.cleanAll);

    context('when the issue exists and is open', () => {
      const ISSUE = {
        iid: 123,
        title: 'Open Issue',
        state: GitLab.ISSUE_STATE_OPEN,
      };
      let addCommentScope;
      let closeIssueScope;
      const COMMENT = 'Closing comment';
      const responseAddcomment = { iid: 123, id: 23, body: COMMENT };
      const closeissueBody = { state_event: 'close' };
      const responseCloseissue = { iid: 123 };

      before(async () => {
        nock(gitlabApiUrl, reqHeaders)
          .get(`/projects/${projectId}/issues?search=${encodeURIComponent(ISSUE.title)}&per_page=100`)
          .reply(200, [ISSUE]);

        addCommentScope = nock(gitlabApiUrl, reqHeaders)
          .post(`/projects/${projectId}/issues/${ISSUE.iid}/notes`, { body: COMMENT })
          .reply(200, responseAddcomment);

        closeIssueScope = nock(gitlabApiUrl, reqHeaders)
          .put(`/projects/${projectId}/issues/${ISSUE.iid}`, closeissueBody)
          .reply(200, responseCloseissue);

        await gitlab.closeIssueWithCommentIfExists({ title: ISSUE.title, comment: COMMENT });
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
        state: GitLab.ISSUE_STATE_CLOSED,
      };
      let addCommentScope;
      let closeIssueScope;
      const COMMENT = 'Closing comment';
      const responseAddcomment = { iid: 123, id: 23, body: COMMENT };
      const closeissueBody = { state_event: 'close' };
      const responseCloseissue = { iid: 123 };

      before(async () => {
        nock(gitlabApiUrl, reqHeaders)
          .get(`/projects/${projectId}/issues?search=${encodeURIComponent(ISSUE.title)}&per_page=100`)
          .reply(200, []);

        addCommentScope = nock(gitlabApiUrl, reqHeaders)
          .post(`/projects/${projectId}/issues/${ISSUE.iid}/notes`, { body: COMMENT })
          .reply(200, responseAddcomment);

        closeIssueScope = nock(gitlabApiUrl, reqHeaders)
          .put(`/projects/${projectId}/issues/${ISSUE.iid}`, closeissueBody)
          .reply(200, responseCloseissue);

        await gitlab.closeIssueWithCommentIfExists({ title: ISSUE.title, comment: COMMENT });
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
      const COMMENT = 'Closing comment';
      const TITLE = 'Non-existent Issue';
      const responseAddcomment = { iid: 123, id: 23, body: COMMENT };
      const closeissueBody = { state_event: 'close' };
      const responseCloseissue = { iid: 123 };

      before(async () => {
        nock(gitlabApiUrl, reqHeaders)
          .get(`/projects/${projectId}/issues?search=${encodeURIComponent(TITLE)}&per_page=100`)
          .reply(200, []);

        addCommentScope = nock(gitlabApiUrl, reqHeaders)
          .post(/\/projects\/\d+\/issues\/\d+\/notes/, { body: COMMENT })
          .reply(200, responseAddcomment);

        closeIssueScope = nock(gitlabApiUrl, reqHeaders)
          .put(/\/projects\/\d+\/issues\/\d+/, closeissueBody)
          .reply(200, responseCloseissue);

        await gitlab.closeIssueWithCommentIfExists({ title: TITLE, comment: COMMENT });
      });

      it('does not attempt to add comment', () => {
        expect(addCommentScope.isDone()).to.be.false;
      });

      it('does not attempt to close the issue', () => {
        expect(closeIssueScope.isDone()).to.be.false;
      });
    });
  });

  describe('#Gitlab_createOrUpdateIssue', () => {
    before(async () => {
      nock(gitlabApiUrl, reqHeaders)
        .get(`/projects/${encodeURIComponent('owner/repo')}`)
        .reply(200, { id: 4 });

      nock(gitlabApiUrl, reqHeaders)
        .get(`/projects/${projectId}/labels?with_counts=true`)
        .reply(200, MANAGED_LABELS);

      await gitlab.initialize();
    });

    context('when the issue does not exist', () => {
      let createIssueScope;
      const ISSUE_TO_CREATE = {
        title: 'New Issue',
        description: 'Description of the new issue',
        label: 'bug',
      };

      before(async () => {
        nock(gitlabApiUrl, reqHeaders)
          .get(`/projects/${projectId}/issues?search=${encodeURIComponent(ISSUE_TO_CREATE.title)}&per_page=100`)
          .reply(200, []); // Simulate that there is no issues on the repository

        createIssueScope = nock(gitlabApiUrl, reqHeaders)
          .post(
            `/projects/${projectId}/issues`,
            {
              title: ISSUE_TO_CREATE.title,
              description: ISSUE_TO_CREATE.description,
              labels: [ISSUE_TO_CREATE.label],
            },
          )
          .reply(200, { iid: 123, web_url: 'https://example.com/test/test' });

        await gitlab.createOrUpdateIssue(ISSUE_TO_CREATE);
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

        const GITLAB_RESPONSE_FOR_EXISTING_ISSUE = {
          iid: 123,
          title: ISSUE.title,
          description: ISSUE.description,
          labels: [{ name: 'selectors' }],
          state: GitLab.ISSUE_STATE_CLOSED,
        };

        const EXPECTED_REQUEST_BODY = { state_event: 'reopen' };
        const responseIssuereopened = { iid: 123 };
        const responseSetLabels = {
          iid: 123,
          labels: ['location'],
        };
        const responseAddcomment = { iid: 123, id: 23, body: ISSUE.description };
        const { iid } = GITLAB_RESPONSE_FOR_EXISTING_ISSUE;

        before(async () => {
          nock(gitlabApiUrl, reqHeaders)
            .get(`/projects/${projectId}/issues?search=${encodeURIComponent(ISSUE.title)}&per_page=100`)
            .reply(200, [GITLAB_RESPONSE_FOR_EXISTING_ISSUE]);

          openIssueScope = nock(gitlabApiUrl, reqHeaders)
            .put(`/projects/${projectId}/issues/${iid}`, EXPECTED_REQUEST_BODY)
            .reply(200, responseIssuereopened);

          setIssueLabelsScope = nock(gitlabApiUrl, reqHeaders)
            .put(`/projects/${projectId}/issues/${iid}`, { labels: ['location'] })
            .reply(200, responseSetLabels);

          addCommentScope = nock(gitlabApiUrl, reqHeaders)
            .post(`/projects/${projectId}/issues/${iid}/notes`, { body: ISSUE.description })
            .reply(200, responseAddcomment);

          await gitlab.createOrUpdateIssue(ISSUE);
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

        const GITLAB_RESPONSE_FOR_EXISTING_ISSUE = {
          number: 123,
          title: ISSUE.title,
          description: ISSUE.description,
          labels: [{ name: 'selectors' }],
          state: GitLab.ISSUE_STATE_OPEN,
        };

        const EXPECTED_REQUEST_BODY = { state_event: 'reopen' };
        const responseIssuereopened = { iid: 123 };
        const responseSetLabels = {
          iid: 123,
          labels: ['location'],
        };
        const responseAddcomment = { iid: 123, id: 23, body: ISSUE.description };
        const { iid } = GITLAB_RESPONSE_FOR_EXISTING_ISSUE;

        before(async () => {
          nock(gitlabApiUrl, reqHeaders)
            .get(`/projects/${projectId}/issues?search=${encodeURIComponent(ISSUE.title)}&per_page=100`)
            .reply(200, [GITLAB_RESPONSE_FOR_EXISTING_ISSUE]);

          openIssueScope = nock(gitlabApiUrl, reqHeaders)
            .put(`/projects/${projectId}/issues/${iid}`, EXPECTED_REQUEST_BODY)
            .reply(200, responseIssuereopened);

          setIssueLabelsScope = nock(gitlabApiUrl, reqHeaders)
            .put(`/projects/${projectId}/issues/${iid}`, { labels: ['location'] })
            .reply(200, responseSetLabels);

          addCommentScope = nock(gitlabApiUrl, reqHeaders)
            .post(`/projects/${projectId}/issues/${iid}/notes`, { body: ISSUE.description })
            .reply(200, responseAddcomment);

          await gitlab.createOrUpdateIssue(ISSUE);
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
