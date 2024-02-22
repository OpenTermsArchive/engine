import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import chai from 'chai';

import { checkChangelog, checkFunder, extractReleaseType, generatePRLink } from './changelog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { expect } = chai;

describe.only('Changelog Tests', () => {
  describe('checkChangelog', () => {
    it('should return true if changelog is properly formatted', async () => {
      const changelogContent = await fs.readFile(path.resolve(__dirname, './fixtures/CHANGELOG.md'), 'UTF-8');

      expect(checkChangelog(changelogContent)).to.be.true;
    });

    it('should return an error if funder is missing in unreleased section', async () => {
      const changelogContent = await fs.readFile(path.resolve(__dirname, './fixtures/invalid/missing-funder-CHANGELOG.md'), 'UTF-8');

      expect(() => checkChangelog(changelogContent)).to.throw(Error);
    });

    it('should return an error if changelog cannot be parsed', async () => {
      const changelogContent = await fs.readFile(path.resolve(__dirname, './fixtures/invalid/misplaced-description-CHANGELOG.md'), 'UTF-8');

      expect(() => checkChangelog(changelogContent)).to.throw(Error);
    });

    it('should return an error if changelog cannot be parsed', async () => {
      const changelogContent = await fs.readFile(path.resolve(__dirname, './fixtures/invalid/missing-change-type-CHANGELOG.md'), 'UTF-8');

      expect(() => checkChangelog(changelogContent)).to.throw(Error);
    });

    it('should return an error if changelog cannot be parsed', async () => {
      const changelogContent = await fs.readFile(path.resolve(__dirname, './fixtures/invalid/wrong-unreleased-title-weight-CHANGELOG.md'), 'UTF-8');

      expect(() => checkChangelog(changelogContent)).to.throw(Error);
    });

    it('should return an error if changelog cannot be parsed', async () => {
      const changelogContent = await fs.readFile(path.resolve(__dirname, './fixtures/invalid/missing-change-CHANGELOG.md'), 'UTF-8');

      expect(() => checkChangelog(changelogContent)).to.throw(Error);
    });
  });

  describe('checkFunder', () => {
    it('should return true if funder is present', () => {
      const description = `
Description start text

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

Description end text
`;

      expect(checkFunder(description)).to.be.true;
    });

    it('should return false if funder is not present', () => {
      const description = `
Description start text

Description end text
`;

      expect(checkFunder(description)).to.be.false;
    });

    it('should return false if funder does not respect the expected format', () => {
      const description = `
Description start text

> Release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

Description end text
`;

      expect(checkFunder(description)).to.be.false;
    });

    it('should return false if funder does not respect the expected format', () => {
      const description = `
Description start text

Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

Description end text
`;

      expect(checkFunder(description)).to.be.false;
    });
  });

  describe('generatePRLink', () => {
    it('should generate the correct PR link', () => {
      const PRNumber = 1056;
      const expectedLink = '_Full changeset and discussions: [#1056](https://github.com/OpenTermsArchive/engine/pull/1056)._';

      expect(generatePRLink(PRNumber)).to.equal(expectedLink);
    });

    it('should handle PR numbers as strings', () => {
      const PRNumber = '999';
      const expectedLink = '_Full changeset and discussions: [#999](https://github.com/OpenTermsArchive/engine/pull/999)._';

      expect(generatePRLink(PRNumber)).to.equal(expectedLink);
    });
  });

  describe('extractReleaseType', () => {
    it('should return "patch" when the Unreleased section indicates a patch release', () => {
      const changelog = `
        # Changelog
  
        ## Unreleased [patch]
        - Some change
      `;

      expect(extractReleaseType(changelog)).to.equal('patch');
    });

    it('should return "minor" when the Unreleased section indicates a minor release', () => {
      const changelog = `
        # Changelog
  
        ## Unreleased [minor]
        - Some change
      `;

      expect(extractReleaseType(changelog)).to.equal('minor');
    });

    it('should return "major" when the Unreleased section indicates a major release', () => {
      const changelog = `
        # Changelog
  
        ## Unreleased [major]
        - Some change
      `;

      expect(extractReleaseType(changelog)).to.equal('major');
    });

    it('should return null if the Unreleased section is not present', () => {
      const changelog = `
        # Changelog
  
        ## 1.0.0 - 2022-01-01
        - Some change
      `;

      expect(extractReleaseType(changelog)).to.be.null;
    });

    it('should return null if the Unreleased release type is not present', () => {
      const changelog = `
        # Changelog
  
        ## 1.0.0 - 2022-01-01
        - Some change
      `;

      expect(extractReleaseType(changelog)).to.be.null;
    });

    it('should return null if the release type is invalid', () => {
      const changelog = `
        # Changelog
  
        ## Unreleased [invalid]
        - Some change
      `;

      expect(extractReleaseType(changelog)).to.be.null;
    });

    it('should handle case-insensitive release types', () => {
      const changelog = `
        # Changelog
  
        ## Unreleased [PATCH]
        - Some change
      `;

      expect(extractReleaseType(changelog)).to.equal('patch');
    });

    it('should handle whitespace in the Unreleased section', () => {
      const changelog = `
        # Changelog
  
        ## Unreleased             [patch]
        - Some change
      `;

      expect(extractReleaseType(changelog)).to.equal('patch');
    });
  });
});
