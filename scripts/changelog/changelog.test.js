import fs from 'fs';

import chai from 'chai';
import sinon from 'sinon';

import Changelog from './changelog.js';
import ChangelogValidationError from './changelogValidationError.js';

const { expect } = chai;

describe.only('Changelog', () => {
  let changelog;

  beforeEach(() => {
    // Set up a mock changelog file
    fs.writeFileSync('test-changelog.md', `
      # Changelog
      
      ## Unreleased [patch]
      - Some change
      
      ## 1.0.0
      - Initial release
    `);

    changelog = new Changelog('test-changelog.md');
  });

  afterEach(() => {
    // Clean up the mock changelog file
    fs.unlinkSync('test-changelog.md');
  });

  describe('constructor', () => {
    it('should initialize the Changelog instance with correct properties', () => {
      expect(changelog.path).to.equal('test-changelog.md');
      expect(changelog.rawContent).to.be.a('string');
      expect(changelog.changelog).to.be.an('object');
    });
  });

  describe('extractReleaseType', () => {
    it('should return null if Unreleased section is missing', () => {
      fs.writeFileSync('test-changelog.md', '# Changelog\n');
      changelog = new Changelog('test-changelog.md');
      expect(changelog.extractReleaseType()).to.be.null;
    });

    it('should return null if release type for Unreleased section is missing', () => {
      fs.writeFileSync('test-changelog.md', `
        # Changelog
        
        ## Unreleased
        - Some change
      `);
      changelog = new Changelog('test-changelog.md');
      expect(changelog.extractReleaseType()).to.be.null;
    });

    it('should return the correct release type', () => {
      expect(changelog.extractReleaseType()).to.equal('patch');
    });
  });

  describe('getReleaseType', () => {
    it('should return the release type', () => {
      expect(changelog.getReleaseType()).to.equal('patch');
    });
  });

  describe('getVersionContent', () => {
    it('should return version content', () => {
      const versionContent = changelog.getVersionContent('1.0.0');

      expect(versionContent).to.contain('Initial release');
    });

    it('should throw an error if version is not found', () => {
      expect(() => changelog.getVersionContent('2.0.0')).to.throw(Error, 'Version 2.0.0 not found in changelog');
    });
  });

  describe('release', () => {
    it('should update the changelog with a new release', () => {
      const writeFileStub = sinon.stub(fs, 'writeFileSync');

      changelog.release('123');
      expect(writeFileStub.calledOnce).to.be.true;
      expect(writeFileStub.firstCall.args[0]).to.equal('test-changelog.md');
      expect(writeFileStub.firstCall.args[1]).to.contain('## Unreleased');
      writeFileStub.restore();
    });
  });

  describe('validateUnreleased', () => {
    it('should not throw error if Unreleased section is missing but no release type is required', () => {
      fs.writeFileSync('test-changelog.md', '# Changelog\n');
      changelog = new Changelog('test-changelog.md');
      expect(() => changelog.validateUnreleased(true)).to.not.throw(ChangelogValidationError);
    });

    it('should not throw error if funder is missing but no release type is required', () => {
      fs.writeFileSync('test-changelog.md', `
        # Changelog
        
        ## Unreleased
        - Some change
      `);
      changelog = new Changelog('test-changelog.md');
      expect(() => changelog.validateUnreleased(true)).to.not.throw(ChangelogValidationError);
    });

    it('should not throw error if changes are missing but no release type is required', () => {
      fs.writeFileSync('test-changelog.md', `
        # Changelog
        
        ## Unreleased [patch]
      `);
      changelog = new Changelog('test-changelog.md');
      expect(() => changelog.validateUnreleased(true)).to.not.throw(ChangelogValidationError);
    });

    it('should throw error if Unreleased section is missing and release type is required', () => {
      fs.writeFileSync('test-changelog.md', '# Changelog\n');
      changelog = new Changelog('test-changelog.md');
      expect(() => changelog.validateUnreleased()).to.throw(ChangelogValidationError, 'Missing Unreleased section');
    });

    it('should throw error if release type for Unreleased section is missing and release type is required', () => {
      fs.writeFileSync('test-changelog.md', `
        # Changelog
        
        ## Unreleased
        - Some change
      `);
      changelog = new Changelog('test-changelog.md');
      expect(() => changelog.validateUnreleased()).to.throw(ChangelogValidationError, 'Invalid or missing release type for Unreleased section');
    });

    it('should throw error if funder is missing and release type is required', () => {
      fs.writeFileSync('test-changelog.md', `
        # Changelog
        
        ## Unreleased [patch]
        - Some change
      `);
      changelog = new Changelog('test-changelog.md');
      expect(() => changelog.validateUnreleased()).to.throw(ChangelogValidationError, 'Missing funder in the Unreleased section');
    });

    it('should throw error if changes are missing and release type is required', () => {
      fs.writeFileSync('test-changelog.md', `
        # Changelog
        
        ## Unreleased [patch]
      `);
      changelog = new Changelog('test-changelog.md');
      expect(() => changelog.validateUnreleased()).to.throw(ChangelogValidationError, 'Missing changes in the Unreleased section');
    });

    it('should not throw error if Unreleased section is valid', () => {
      expect(() => changelog.validateUnreleased()).to.not.throw(ChangelogValidationError);
    });
  });
});
