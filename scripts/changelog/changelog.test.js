import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect } from 'chai';

import Changelog from './changelog.js';
import ChangelogValidationError from './changelogValidationError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Changelog', () => {
  let changelog;

  describe('#releaseType', () => {
    context('with a properly formed changelog', () => {
      it('returns the correct release type', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog.md'), 'UTF-8'));
        expect(changelog.releaseType).to.equal('major');
      });
    });

    context('when "Unreleased" section does not exist', () => {
      it('returns null', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog-without-unreleased.md'), 'UTF-8'));
        expect(changelog.releaseType).to.be.null;
      });
    });
    context('when "Unreleased" section has a malformed release type', () => {
      it('returns null', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog-with-unreleased-malformed.md'), 'UTF-8'));
        expect(changelog.releaseType).to.be.null;
      });
    });
  });

  describe('#getVersionContent', () => {
    context('when getting an exisiting version', () => {
      it('returns the content of the specified version', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog.md'), 'UTF-8'));
        const versionContent = changelog.getVersionContent('0.0.1');

        expect(versionContent).to.equal(`## 0.0.1 - 2024-02-20

_Full changeset and discussions: #122._

> Development of this release was funded by ABC.

### Added

- Initial release`);
      });
    });

    context('when getting a non-existing version', () => {
      it('throws an error', () => {
        expect(() => changelog.getVersionContent('2.0.0')).to.throw(Error);
      });
    });
  });

  describe('#cleanUnreleased', () => {
    context('when "Unreleased" section exists', () => {
      it('removes the section', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog-with-unreleased-no-release.md'), 'UTF-8'));
        changelog.cleanUnreleased();
        const updatedChangelog = changelog.toString();

        expect(updatedChangelog).to.not.include('## Unreleased');
      });
    });

    context('when "Unreleased" section does not exist', () => {
      it('does not throw any error', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog-without-unreleased.md'), 'UTF-8'));
        expect(() => changelog.cleanUnreleased()).to.not.throw();
      });
    });
  });

  describe('#release', () => {
    context('with a properly formed changelog', () => {
      it('returns an updated version of the changelog', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog.md'), 'UTF-8'));
        changelog.release();
        let expectedResult = await fs.readFile(path.resolve(__dirname, './fixtures/changelog-released.md'), 'UTF-8');

        expectedResult = expectedResult.replace('<DATE_OF_THE_DAY_PLACEHOLDER>', `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`);
        expect(changelog.toString()).to.equal(expectedResult);
      });
    });

    context('when there is a validation error on the "Unreleased" section', () => {
      it('throws an error', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog-without-unreleased.md'), 'UTF-8'));
        expect(() => changelog.release(124)).to.throw(Error, 'Missing "Unreleased" section');
      });
    });
  });

  describe('#validateUnreleased', () => {
    context('with a properly formed "Unreleased" section', () => {
      it('does not throw any error', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog.md'), 'UTF-8'));
        expect(() => changelog.validateUnreleased()).to.not.throw();
      });
    });

    context('when "Unreleased" section is missing', () => {
      it('throws a ChangelogValidationError error with proper message', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog-without-unreleased.md'), 'UTF-8'));
        expect(() => changelog.validateUnreleased()).to.throw(ChangelogValidationError, 'Missing "Unreleased" section');
      });
    });

    context('when release type is invalid or missing', () => {
      it('throws a ChangelogValidationError error with proper message', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog-with-unreleased-malformed.md'), 'UTF-8'));
        expect(() => changelog.validateUnreleased()).to.throw(ChangelogValidationError, 'Invalid or missing release type for "Unreleased" section. Please ensure the section contains a valid release type (major, minor, or patch)');
      });
    });

    context('when funder is missing', () => {
      it('throws a ChangelogValidationError error with proper message', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog-without-funder.md'), 'UTF-8'));
        expect(() => changelog.validateUnreleased()).to.throw(ChangelogValidationError, 'Missing funder in the "Unreleased" section');
      });
    });

    context('when changes are missing', () => {
      it('throws a ChangelogValidationError error with proper message', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog-without-changes.md'), 'UTF-8'));
        expect(() => changelog.validateUnreleased()).to.throw(ChangelogValidationError, 'Missing or malformed changes in the "Unreleased" section');
      });
    });

    context('when changes are malformed', () => {
      it('throws a ChangelogValidationError error with proper message', async () => {
        changelog = new Changelog(await fs.readFile(path.resolve(__dirname, './fixtures/changelog-without-changes.md'), 'UTF-8'));
        expect(() => changelog.validateUnreleased()).to.throw(ChangelogValidationError, 'Missing or malformed changes in the "Unreleased" section');
      });
    });
  });
});
