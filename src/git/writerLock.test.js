import { execFile, spawn } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { promisify } from 'util';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { acquireWriterLock, WriterLockHeldError } from './writerLock.js';

use(chaiAsPromised);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('WriterLock', () => {
  describe('#acquireWriterLock', () => {
    let directory;
    let lockFilePath;

    beforeEach(async () => {
      directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ota-writer-lock-'));
      lockFilePath = path.join(directory, 'writer.lock');
    });

    afterEach(() => fs.rm(directory, { recursive: true, force: true }));

    async function writeLock(content, { date } = {}) {
      await fs.writeFile(lockFilePath, content);

      if (date) {
        await fs.utimes(lockFilePath, date, date);
      }
    }

    it('writes the PID of the current process in the lock file', async () => {
      await acquireWriterLock(lockFilePath);

      expect(await fs.readFile(lockFilePath, 'utf8')).to.equal(String(process.pid));
    });

    it('can be acquired again by the same process', async () => {
      await acquireWriterLock(lockFilePath);

      await expect(acquireWriterLock(lockFilePath)).to.be.fulfilled;
    });

    context('when another running process holds the lock', () => {
      let otherProcess;

      beforeEach(async () => {
        otherProcess = spawn(process.execPath, [ '-e', 'setInterval(() => {}, 1000)' ]);
        await writeLock(String(otherProcess.pid));
      });

      afterEach(() => otherProcess.kill());

      it('rejects with an error naming the holder and the lock file', async () => {
        const error = await acquireWriterLock(lockFilePath).catch(error => error);

        expect(error).to.be.an.instanceOf(WriterLockHeldError);
        expect(error.holderPid).to.equal(otherProcess.pid);
        expect(error.lockFilePath).to.equal(lockFilePath);
      });

      it('leaves the lock to its holder', async () => {
        await acquireWriterLock(lockFilePath).catch(() => {});

        expect(await fs.readFile(lockFilePath, 'utf8')).to.equal(String(otherProcess.pid));
      });

      context('when the lock was written before the last boot', () => {
        beforeEach(() => writeLock(String(otherProcess.pid), { date: new Date(Date.now() - (os.uptime() + 60) * 1000) }));

        it('takes over the lock', async () => {
          await acquireWriterLock(lockFilePath);

          expect(await fs.readFile(lockFilePath, 'utf8')).to.equal(String(process.pid));
        });
      });
    });

    context('when the lock was left by a process that no longer runs', () => {
      beforeEach(async () => {
        const { pid } = await new Promise(resolve => {
          const exitedProcess = spawn(process.execPath, [ '-e', '' ]);

          exitedProcess.on('exit', () => resolve(exitedProcess));
        });

        await writeLock(String(pid));
      });

      it('takes over the lock', async () => {
        await acquireWriterLock(lockFilePath);

        expect(await fs.readFile(lockFilePath, 'utf8')).to.equal(String(process.pid));
      });

      it('leaves no copy of the stale lock behind', async () => {
        await acquireWriterLock(lockFilePath);

        expect(await fs.readdir(directory)).to.deep.equal(['writer.lock']);
      });
    });

    context('when the lock file is empty', () => {
      beforeEach(() => writeLock(''));

      it('takes over the lock', async () => {
        await acquireWriterLock(lockFilePath);

        expect(await fs.readFile(lockFilePath, 'utf8')).to.equal(String(process.pid));
      });
    });

    context('when the process exits', function () {
      this.timeout(10000); // Starts a separate Node.js process

      function runInSeparateProcess(script) {
        return promisify(execFile)(process.execPath, [ '--input-type=module', '-e', `import { acquireWriterLock } from ${JSON.stringify(pathToFileURL(path.join(__dirname, 'writerLock.js')).href)}; ${script}` ]); // A file URL rather than a path: on Windows, an absolute path is parsed by the ESM loader as a URL with the drive letter as scheme, which it refuses
      }

      it('releases the lock', async () => {
        await runInSeparateProcess(`await acquireWriterLock(${JSON.stringify(lockFilePath)});`);

        await expect(fs.access(lockFilePath)).to.be.rejected;
      });

      context('when another process took the lock over meanwhile', () => {
        it('leaves the lock to that process', async () => {
          await runInSeparateProcess(`import fs from 'fs/promises'; await acquireWriterLock(${JSON.stringify(lockFilePath)}); await fs.writeFile(${JSON.stringify(lockFilePath)}, '${process.pid}');`);

          expect(await fs.readFile(lockFilePath, 'utf8')).to.equal(String(process.pid));
        });
      });
    });
  });
});
