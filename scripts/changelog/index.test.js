import { exec } from 'child_process';

import { expect } from 'chai';

describe('CLI', () => {
  it('should display help message when no arguments are provided', done => {
    exec('node your-cli-script.js', (error, stdout) => {
      if (error) {
        done(error);

        return;
      }
      expect(stdout).to.contain('Usage: changelog [options]');
      done();
    });
  });

  it('should display help message when --help option is provided', done => {
    exec('node your-cli-script.js --help', (error, stdout) => {
      if (error) {
        done(error);

        return;
      }
      expect(stdout).to.contain('Usage: changelog [options]');
      done();
    });
  });

  it('should display version when --version option is provided', done => {
    exec('node your-cli-script.js --version', (error, stdout) => {
      if (error) {
        done(error);

        return;
      }
      expect(stdout).to.match(/^\d+\.\d+\.\d+/); // Assumes version number is in format X.X.X
      done();
    });
  });

  it('should display release type when --get-release-type option is provided', done => {
    exec('node your-cli-script.js --get-release-type', (error, stdout) => {
      if (error) {
        done(error);

        return;
      }
      expect(stdout.trim()).to.be.oneOf([ 'major', 'minor', 'patch' ]);
      done();
    });
  });

  it('should display version content when --get-version-content option with version is provided', done => {
    exec('node your-cli-script.js --get-version-content 1.0.0', (error, stdout) => {
      if (error) {
        done(error);

        return;
      }
      expect(stdout).to.contain('Initial release');
      done();
    });
  });

  it('should not throw error when --validate option is provided', done => {
    exec('node your-cli-script.js --validate', (error, stdout, stderr) => {
      expect(error).to.be.null;
      expect(stderr).to.be.empty;
      done();
    });
  });

  it('should not throw error when --release option with PRNumber is provided', done => {
    exec('node your-cli-script.js --release 123', (error, stdout, stderr) => {
      expect(error).to.be.null;
      expect(stderr).to.be.empty;
      done();
    });
  });

  it('should update changelog file when --release option with PRNumber is provided', done => {
    exec('node your-cli-script.js --release 123', error => {
      if (error) {
        done(error);

        return;
      }
      // Check if the changelog file has been updated
      // You may need to read the file and compare its content
      done();
    });
  });
});
