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
});
