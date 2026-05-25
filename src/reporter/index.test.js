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
      repositories: { declarations: 'OpenTermsArchive/test-declarations' },
    });

    const buildTerms = ({ sourceCount = 1 } = {}) => {
      const sourceDocuments = Array.from({ length: sourceCount }, (_, index) => ({
        id: `source-${index}`,
        location: `https://example.com/source-${index}`,
        mimeType: 'text/html',
        snapshotId: `snapshot-${index}`,
        toPersistence: () => ({ fetch: `https://example.com/source-${index}` }),
      }));

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
