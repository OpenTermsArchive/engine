import { expect } from 'chai';

import Reporter from './index.js';

describe('Reporter', () => {
  describe('#normalizeConfig', () => {
    context('with current config format', () => {
      it('returns the config as is', () => {
        const config = { repositories: { declarations: 'owner/repo' } };
        const normalizedConfig = Reporter.normalizeConfig(config);

        expect(normalizedConfig).to.deep.equal(config);
      });
    });

    context('with old config format where githubIssues is nested under reporter', () => {
      it('returns a normalized config', () => {
        const config = { githubIssues: { repositories: { declarations: 'owner/repo' } } };
        const expectedConfig = {
          type: 'github',
          repositories: { declarations: 'owner/repo' },
        };
        const normalizedConfig = Reporter.normalizeConfig(config);

        expect(normalizedConfig).to.deep.equal(expectedConfig);
      });
    });
  });

  describe('#validateConfiguration', () => {
    context('with valid configuration', () => {
      it('does not throw an error', () => {
        const repositories = { declarations: 'owner/repo' };

        expect(() => {
          Reporter.validateConfiguration(repositories);
        }).not.to.throw();
      });
    });

    context('with invalid configuration', () => {
      context('when declarations key is missing', () => {
        it('throws an error', () => {
          const repositories = {};

          expect(() => {
            Reporter.validateConfiguration(repositories);
          }).to.throw().and.have.property('message').that.match(/Required configuration key.*was not found/);
        });
      });

      context('when repository format is incorrect', () => {
        it('throws an error', () => {
          const repositories = { declarations: 'invalidFormat' };

          expect(() => {
            Reporter.validateConfiguration(repositories);
          }).to.throw('Configuration entry "reporter.repositories.declarations" is expected to be a string in the format <owner>/<repo>, but received: "invalidFormat"');
        });
      });
    });
  });

  describe('#generateDescription', () => {
    const buildReporter = () => new Reporter({
      type: 'github',
      repositories: { declarations: 'OpenTermsArchive/test-declarations', snapshots: 'OpenTermsArchive/test-snapshots' },
    });

    const buildTerms = ({ sourceCount = 1, hasSnapshots = true, withoutSnapshotIndexes = [] } = {}) => {
      const sourceDocuments = Array.from({ length: sourceCount }, (_, index) => {
        const hasSnapshot = hasSnapshots && !withoutSnapshotIndexes.includes(index); // A document that has never been recorded has neither a snapshot ID nor an observed MIME type

        return {
          id: `source-${index}`,
          location: `https://example.com/source-${index}`,
          mimeType: hasSnapshot ? 'text/html' : null,
          snapshotId: hasSnapshot ? `snapshot-${index}` : null,
          toPersistence: () => ({ fetch: `https://example.com/source-${index}` }),
        };
      });

      return {
        service: { id: 'TestService', name: 'TestService' },
        type: 'Terms of Service',
        sourceDocuments,
        hasMultipleSourceDocuments: sourceCount > 1,
        toPersistence: () => ({
          name: 'TestService',
          terms: {
            'Terms of Service': sourceCount > 1
              ? { combine: sourceDocuments.map(sourceDocument => sourceDocument.toPersistence()) }
              : sourceDocuments[0].toPersistence(),
          },
        }),
      };
    };

    const error = { reasons: ['HTTP code 404'] };

    context('when the source documents have been recorded as snapshots', () => {
      it('mentions that the missed versions might be recovered', () => {
        const description = buildReporter().generateDescription({ error, terms: buildTerms() });

        expect(description).to.include('it might still be possible to recover the missed versions');
      });
    });

    context('when the source documents could not be recorded as snapshots', () => {
      it('does not suggest that the missed versions might be recovered', () => {
        const description = buildReporter().generateDescription({ error, terms: buildTerms({ hasSnapshots: false }) });

        expect(description).to.include('has not been recorded as a snapshot');
        expect(description).to.not.include('it might still be possible to recover the missed versions');
      });

      it('omits the snapshot link, which would point to a nonexistent file', () => {
        const description = buildReporter().generateDescription({ error, terms: buildTerms({ hasSnapshots: false }) });

        expect(description).to.not.include('Latest snapshot');
        expect(description).to.not.include('.null');
      });
    });

    context('when a source document of combined terms has never been recorded as a snapshot', () => {
      it('omits its snapshot link and keeps the ones of the recorded documents', () => {
        const description = buildReporter().generateDescription({ error, terms: buildTerms({ sourceCount: 2, withoutSnapshotIndexes: [1] }) });

        expect(description).to.include('#source-0.html'); // The `#<id>` fragment only appears in snapshot links, unlike the document locations listed in the accessibility checklist
        expect(description).to.not.include('#source-1');
        expect(description).to.not.include('.null');
      });
    });

    context('when the terms has a single source document', () => {
      it('deep-links to the contribution tool with the serialized declaration as the edit target', () => {
        const description = buildReporter().generateDescription({ error, terms: buildTerms({ sourceCount: 1 }) });

        expect(description).to.match(/\(https:\/\/contribute\.opentermsarchive\.org\/[^)]*\bjson=[^)]*\)/);
      });
    });

    context('when the terms has multiple source documents (combine)', () => {
      it('does not deep-link to the contribution tool because it cannot edit multi-source declarations', () => {
        const description = buildReporter().generateDescription({ error, terms: buildTerms({ sourceCount: 5 }) });

        expect(description).to.not.include('json=');
      });

      it('links to the declaration file on GitHub as the edit target', () => {
        const description = buildReporter().generateDescription({ error, terms: buildTerms({ sourceCount: 5 }) });

        expect(description).to.include('github.com/OpenTermsArchive/test-declarations/blob/main/declarations/TestService.json');
      });

      it('keeps the description below the GitHub 65,536-character issue body limit even with many sources', () => {
        const description = buildReporter().generateDescription({ error, terms: buildTerms({ sourceCount: 50 }) });

        expect(description.length).to.be.lessThan(65000);
      });
    });
  });
});
