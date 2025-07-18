import { expect } from 'chai';
import nock from 'nock';

import { LABELS, MANAGED_BY_OTA_MARKER } from '../labels.js';

import GitLab from './index.js';

describe('GitLab', function () {
  this.timeout(5000);

  let MANAGED_LABELS;
  let gitlab;
  const PROJECT_ID = '4';

  before(() => {
    MANAGED_LABELS = Object.values(LABELS);
    gitlab = new GitLab('owner/repo');
  });

  describe('#initialize', () => {
    context('when some labels are missing', () => {
      const scopes = [];

      before(async () => {
        const existingLabels = MANAGED_LABELS.slice(0, -2).map(label => ({
          ...label,
          description: `${label.description} ${MANAGED_BY_OTA_MARKER}`,
        }));

        nock(gitlab.apiBaseURL)
          .get(`/projects/${encodeURIComponent('owner/repo')}`)
          .reply(200, { id: PROJECT_ID });

        nock(gitlab.apiBaseURL)
          .get(`/projects/${PROJECT_ID}/labels?with_counts=true`)
          .reply(200, existingLabels);

        const missingLabels = MANAGED_LABELS.slice(-2);

        for (const label of missingLabels) {
          scopes.push(nock(gitlab.apiBaseURL)
            .post(`/projects/${PROJECT_ID}/labels`)
            .reply(200, { name: label.name }));
        }

        await gitlab.initialize();
      });

      after(nock.cleanAll);

      it('should create missing labels', () => {
        scopes.forEach(scope => expect(scope.isDone()).to.be.true);
      });
    });

    context('when some labels are obsolete', () => {
      const deleteScopes = [];

      before(async () => {
        const existingLabels = [
          ...MANAGED_LABELS.map(label => ({
            ...label,
            description: `${label.description} ${MANAGED_BY_OTA_MARKER}`,
          })),
          // Add an obsolete label that should be removed
          {
            name: 'obsolete label',
            color: '#FF0000',
            description: `This label is no longer used ${MANAGED_BY_OTA_MARKER}`,
          },
        ];

        nock(gitlab.apiBaseURL)
          .get(`/projects/${encodeURIComponent('owner/repo')}`)
          .reply(200, { id: PROJECT_ID });

        nock(gitlab.apiBaseURL)
          .get(`/projects/${PROJECT_ID}/labels?with_counts=true`)
          .reply(200, existingLabels);

        // Mock the delete call for the obsolete label
        deleteScopes.push(nock(gitlab.apiBaseURL)
          .delete(`/projects/${PROJECT_ID}/labels/${encodeURIComponent('obsolete label')}`)
          .reply(200));

        // Mock the second getRepositoryLabels call after deletion
        nock(gitlab.apiBaseURL)
          .get(`/projects/${PROJECT_ID}/labels?with_counts=true`)
          .reply(200, MANAGED_LABELS.map(label => ({
            ...label,
            description: `${label.description} ${MANAGED_BY_OTA_MARKER}`,
          })));

        await gitlab.initialize();
      });

      after(nock.cleanAll);

      it('should remove obsolete managed labels', () => {
        deleteScopes.forEach(scope => expect(scope.isDone()).to.be.true);
      });
    });

    context('when some labels have changed descriptions', () => {
      const updateScopes = [];

      before(async () => {
        const originalTestLabels = MANAGED_LABELS.slice(-2);
        const testLabels = originalTestLabels.map(label => ({
          ...label,
          description: `${label.description} - obsolete description`,
        }));

        nock(gitlab.apiBaseURL)
          .get(`/projects/${encodeURIComponent('owner/repo')}`)
          .reply(200, { id: PROJECT_ID });

        nock(gitlab.apiBaseURL)
          .persist()
          .get(`/projects/${PROJECT_ID}/labels?with_counts=true`)
          .reply(200, [ ...MANAGED_LABELS.slice(0, -2), ...testLabels ].map(label => ({
            ...label,
            description: `${label.description} ${MANAGED_BY_OTA_MARKER}`,
          })));

        for (const label of originalTestLabels) {
          updateScopes.push(nock(gitlab.apiBaseURL)
            .put(`/projects/${PROJECT_ID}/labels/${encodeURIComponent(label.name)}`, body =>
              body.description === `${label.description} ${MANAGED_BY_OTA_MARKER}`)
            .reply(200, { name: label.name, color: `#${label.color}` }));
        }

        await gitlab.initialize();
      });

      after(() => {
        nock.cleanAll();
      });

      it('should update labels with changed descriptions', () => {
        updateScopes.forEach(scope => expect(scope.isDone()).to.be.true);
      });
    });
  });

  describe('#getRepositoryLabels', () => {
    let scope;
    let result;
    const LABELS = [{ name: 'bug' }, { name: 'enhancement' }];

    before(async () => {
      scope = nock(gitlab.apiBaseURL)
        .get(`/projects/${PROJECT_ID}/labels?with_counts=true`)
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

  describe('#createLabel', () => {
    let scope;
    const LABEL = { name: 'new_label', color: 'ffffff' };

    before(async () => {
      scope = nock(gitlab.apiBaseURL)
        .post(`/projects/${PROJECT_ID}/labels`, body => body.name === LABEL.name)
        .reply(200, LABEL);

      await gitlab.createLabel(LABEL);
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
    const CREATED_ISSUE = {
      title: 'New Issue',
      description: 'Description of the new issue',
      labels: ['bug'],
      iid: 555,
      web_url: 'https://example.com/test/test',
    };

    before(async () => {
      scope = nock(gitlab.apiBaseURL)
        .post(`/projects/${PROJECT_ID}/issues`)
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

  describe('#setIssueLabels', () => {
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
      scope = nock(gitlab.apiBaseURL)
        .put(`/projects/${PROJECT_ID}/issues/${issue.iid}`, { labels })
        .reply(200, response);

      await gitlab.setIssueLabels({ issue, labels });
    });

    after(nock.cleanAll);

    it('sets labels on the issue', () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#openIssue', () => {
    let scope;
    const ISSUE = { iid: 123, title: 'issue reopened' };
    const EXPECTED_REQUEST_BODY = { state_event: 'reopen' };
    const response = { iid: 123 };

    before(async () => {
      scope = nock(gitlab.apiBaseURL)
        .put(`/projects/${PROJECT_ID}/issues/${ISSUE.iid}`, EXPECTED_REQUEST_BODY)
        .reply(200, response);

      await gitlab.openIssue(ISSUE);
    });

    after(nock.cleanAll);

    it('opens the issue', () => {
      expect(scope.isDone()).to.be.true;
    });
  });

  describe('#closeIssue', () => {
    let scope;
    const ISSUE = { iid: 123, title: 'close issue' };
    const EXPECTED_REQUEST_BODY = { state_event: 'close' };
    const response = { iid: 123 };

    before(async () => {
      scope = nock(gitlab.apiBaseURL)
        .put(`/projects/${PROJECT_ID}/issues/${ISSUE.iid}`, EXPECTED_REQUEST_BODY)
        .reply(200, response);

      await gitlab.closeIssue(ISSUE);
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
      scope = nock(gitlab.apiBaseURL)
        .get(`/projects/${PROJECT_ID}/issues?search=${encodeURIComponent(ISSUE.title)}&per_page=100`)
        .reply(200, [ ISSUE, ANOTHER_ISSUE ]);

      result = await gitlab.getIssue({ title: ISSUE.title, state: GitLab.ISSUE_STATE_ALL });
    });

    after(nock.cleanAll);

    it('searches for the issue', () => {
      expect(scope.isDone()).to.be.true;
    });

    it('returns the expected issue', () => {
      expect(result).to.deep.equal(ISSUE);
    });
  });

  describe('#getIssueWithStatus', () => {
    let scope;
    let result;

    const ISSUE = { number: 123, title: 'Test Issue', state: 'opened' };
    const ANOTHER_ISSUE = { number: 124, title: 'Test Issue 2', state: 'opened' };

    before(async () => {
      scope = nock(gitlab.apiBaseURL)
        .get(`/projects/${PROJECT_ID}/issues?search=${encodeURIComponent(ISSUE.title)}&state=${GitLab.ISSUE_STATE_OPEN}&per_page=100`)
        .reply(200, [ ISSUE, ANOTHER_ISSUE ]);

      result = await gitlab.getIssue({ title: ISSUE.title, state: GitLab.ISSUE_STATE_OPEN });
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
    const ISSUE = { iid: 123, title: 'Test Issue' };
    const COMMENT = 'Test comment';
    const response = { iid: 123, id: 23, body: 'Test comment' };

    before(async () => {
      scope = nock(gitlab.apiBaseURL)
        .post(`/projects/${PROJECT_ID}/issues/${ISSUE.iid}/notes`, { body: COMMENT })
        .reply(200, response);

      await gitlab.addCommentToIssue({ issue: ISSUE, comment: COMMENT });
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
        nock(gitlab.apiBaseURL)
          .get(`/projects/${PROJECT_ID}/issues?search=${encodeURIComponent(ISSUE.title)}&state=${GitLab.ISSUE_STATE_OPEN}&per_page=100`)
          .reply(200, [ISSUE]);

        addCommentScope = nock(gitlab.apiBaseURL)
          .post(`/projects/${PROJECT_ID}/issues/${ISSUE.iid}/notes`, { body: COMMENT })
          .reply(200, responseAddcomment);

        closeIssueScope = nock(gitlab.apiBaseURL)
          .put(`/projects/${PROJECT_ID}/issues/${ISSUE.iid}`, closeissueBody)
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
        nock(gitlab.apiBaseURL)
          .get(`/projects/${PROJECT_ID}/issues?search=${encodeURIComponent(ISSUE.title)}&per_page=100`)
          .reply(200, []);

        addCommentScope = nock(gitlab.apiBaseURL)
          .post(`/projects/${PROJECT_ID}/issues/${ISSUE.iid}/notes`, { body: COMMENT })
          .reply(200, responseAddcomment);

        closeIssueScope = nock(gitlab.apiBaseURL)
          .put(`/projects/${PROJECT_ID}/issues/${ISSUE.iid}`, closeissueBody)
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
        nock(gitlab.apiBaseURL)
          .get(`/projects/${PROJECT_ID}/issues?search=${encodeURIComponent(TITLE)}&per_page=100`)
          .reply(200, []);

        addCommentScope = nock(gitlab.apiBaseURL)
          .post(/\/projects\/\d+\/issues\/\d+\/notes/, { body: COMMENT })
          .reply(200, responseAddcomment);

        closeIssueScope = nock(gitlab.apiBaseURL)
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

  describe('#createOrUpdateIssue', () => {
    before(async () => {
      nock(gitlab.apiBaseURL)
        .get(`/projects/${encodeURIComponent('owner/repo')}`)
        .reply(200, { id: 4 });

      nock(gitlab.apiBaseURL)
        .get(`/projects/${PROJECT_ID}/labels?with_counts=true`)
        .reply(200, MANAGED_LABELS);

      await gitlab.initialize();
    });

    after(nock.cleanAll);

    context('when the issue does not exist', () => {
      let createIssueScope;
      const ISSUE_TO_CREATE = {
        title: 'New Issue',
        description: 'Description of the new issue',
        labels: ['empty response'],
      };

      before(async () => {
        nock(gitlab.apiBaseURL)
          .get(`/projects/${PROJECT_ID}/issues?search=${encodeURIComponent(ISSUE_TO_CREATE.title)}&per_page=100`)
          .reply(200, []); // Simulate that there is no issues on the repository

        createIssueScope = nock(gitlab.apiBaseURL)
          .post(
            `/projects/${PROJECT_ID}/issues`,
            {
              title: ISSUE_TO_CREATE.title,
              description: ISSUE_TO_CREATE.description,
              labels: ISSUE_TO_CREATE.labels,
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
        labels: ['page access restriction'],
      };

      context('when issue is closed', () => {
        let setIssueLabelsScope;
        let addCommentScope;
        let openIssueScope;

        const GITLAB_RESPONSE_FOR_EXISTING_ISSUE = {
          iid: 123,
          title: ISSUE.title,
          description: ISSUE.description,
          labels: [{ name: 'empty content' }],
          state: GitLab.ISSUE_STATE_CLOSED,
        };

        const EXPECTED_REQUEST_BODY = { state_event: 'reopen' };
        const responseIssuereopened = { iid: 123 };
        const responseSetLabels = {
          iid: 123,
          labels: ['page access restriction'],
        };
        const responseAddcomment = { iid: 123, id: 23, body: ISSUE.description };
        const { iid } = GITLAB_RESPONSE_FOR_EXISTING_ISSUE;

        before(async () => {
          nock(gitlab.apiBaseURL)
            .get(`/projects/${PROJECT_ID}/issues?search=${encodeURIComponent(ISSUE.title)}&per_page=100`)
            .reply(200, [GITLAB_RESPONSE_FOR_EXISTING_ISSUE]);

          openIssueScope = nock(gitlab.apiBaseURL)
            .put(`/projects/${PROJECT_ID}/issues/${iid}`, EXPECTED_REQUEST_BODY)
            .reply(200, responseIssuereopened);

          setIssueLabelsScope = nock(gitlab.apiBaseURL)
            .put(`/projects/${PROJECT_ID}/issues/${iid}`, { labels: ['page access restriction'] })
            .reply(200, responseSetLabels);

          addCommentScope = nock(gitlab.apiBaseURL)
            .post(`/projects/${PROJECT_ID}/issues/${iid}/notes`, { body: ISSUE.description })
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

        context('when the reason is new', () => {
          const GITLAB_RESPONSE_FOR_EXISTING_ISSUE = {
            iid: 123,
            title: ISSUE.title,
            description: ISSUE.description,
            labels: [{ name: 'empty content' }],
            state: GitLab.ISSUE_STATE_OPEN,
          };

          const EXPECTED_REQUEST_BODY = { state_event: 'reopen' };
          const responseIssuereopened = { iid: 123 };
          const responseSetLabels = {
            iid: 123,
            labels: ['page access restriction'],
          };
          const responseAddcomment = { iid: 123, id: 23, body: ISSUE.description };
          const { iid } = GITLAB_RESPONSE_FOR_EXISTING_ISSUE;

          before(async () => {
            nock(gitlab.apiBaseURL)
              .get(`/projects/${PROJECT_ID}/issues?search=${encodeURIComponent(ISSUE.title)}&per_page=100`)
              .reply(200, [GITLAB_RESPONSE_FOR_EXISTING_ISSUE]);

            openIssueScope = nock(gitlab.apiBaseURL)
              .put(`/projects/${PROJECT_ID}/issues/${iid}`, EXPECTED_REQUEST_BODY)
              .reply(200, responseIssuereopened);

            setIssueLabelsScope = nock(gitlab.apiBaseURL)
              .put(`/projects/${PROJECT_ID}/issues/${iid}`, { labels: ['page access restriction'] })
              .reply(200, responseSetLabels);

            addCommentScope = nock(gitlab.apiBaseURL)
              .post(`/projects/${PROJECT_ID}/issues/${iid}/notes`, { body: ISSUE.description })
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

        context('when all requested labels are already present', () => {
          let setIssueLabelsScope;
          let addCommentScope;
          let openIssueScope;

          const GITLAB_RESPONSE_FOR_EXISTING_ISSUE = {
            iid: 123,
            title: ISSUE.title,
            description: ISSUE.description,
            labels: [{ name: 'page access restriction' }, { name: 'server error' }],
            state: GitLab.ISSUE_STATE_OPEN,
          };

          const { iid } = GITLAB_RESPONSE_FOR_EXISTING_ISSUE;

          before(async () => {
            nock(gitlab.apiBaseURL)
              .get(`/projects/${PROJECT_ID}/issues?search=${encodeURIComponent(ISSUE.title)}&per_page=100`)
              .reply(200, [GITLAB_RESPONSE_FOR_EXISTING_ISSUE]);

            openIssueScope = nock(gitlab.apiBaseURL)
              .put(`/projects/${PROJECT_ID}/issues/${iid}`)
              .reply(200);

            setIssueLabelsScope = nock(gitlab.apiBaseURL)
              .put(`/projects/${PROJECT_ID}/issues/${iid}`)
              .reply(200);

            addCommentScope = nock(gitlab.apiBaseURL)
              .post(`/projects/${PROJECT_ID}/issues/${iid}/notes`)
              .reply(200);

            await gitlab.createOrUpdateIssue({
              title: ISSUE.title,
              description: ISSUE.description,
              labels: [ 'page access restriction', 'server error' ],
            });
          });

          it('does not change the issue state', () => {
            expect(openIssueScope.isDone()).to.be.false;
          });

          it('does not attempt to update the issue labels', () => {
            expect(setIssueLabelsScope.isDone()).to.be.false;
          });

          it('does not attempt to add any comment to the issue', () => {
            expect(addCommentScope.isDone()).to.be.false;
          });
        });

        context('when some but not all requested labels are present', () => {
          let setIssueLabelsScope;
          let addCommentScope;
          let openIssueScope;

          before(() => {
            nock.cleanAll();
          });

          const GITLAB_RESPONSE_FOR_EXISTING_ISSUE = {
            iid: 123,
            title: ISSUE.title,
            description: ISSUE.description,
            labels: [{ name: 'page access restriction' }],
            state: GitLab.ISSUE_STATE_OPEN,
          };

          const EXPECTED_REQUEST_BODY = { state_event: 'reopen' };
          const responseIssuereopened = { iid: 123 };
          const responseSetLabels = {
            iid: 123,
            labels: [ 'page access restriction', 'empty content' ],
          };
          const responseAddcomment = { iid: 123, id: 23, body: ISSUE.description };
          const { iid } = GITLAB_RESPONSE_FOR_EXISTING_ISSUE;

          before(async () => {
            nock(gitlab.apiBaseURL)
              .get(`/projects/${PROJECT_ID}/issues?search=${encodeURIComponent(ISSUE.title)}&per_page=100`)
              .reply(200, [GITLAB_RESPONSE_FOR_EXISTING_ISSUE]);

            openIssueScope = nock(gitlab.apiBaseURL)
              .put(`/projects/${PROJECT_ID}/issues/${iid}`, EXPECTED_REQUEST_BODY)
              .reply(200, responseIssuereopened);

            setIssueLabelsScope = nock(gitlab.apiBaseURL)
              .put(`/projects/${PROJECT_ID}/issues/${iid}`, { labels: [ 'page access restriction', 'empty content' ] })
              .reply(200, responseSetLabels);

            addCommentScope = nock(gitlab.apiBaseURL)
              .post(`/projects/${PROJECT_ID}/issues/${iid}/notes`, { body: ISSUE.description })
              .reply(200, responseAddcomment);

            await gitlab.createOrUpdateIssue({
              title: ISSUE.title,
              description: ISSUE.description,
              labels: [ 'page access restriction', 'empty content' ],
            });
          });

          it('does not change the issue state', () => {
            expect(openIssueScope.isDone()).to.be.false;
          });

          it("updates the issue's labels", () => {
            expect(setIssueLabelsScope.isDone()).to.be.true;
          });

          it('adds comment to the issue', () => {
            expect(addCommentScope.isDone()).to.be.true;
          });
        });
      });
    });
  });
});
