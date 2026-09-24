import fsApi from 'fs';
import os from 'os';

const fs = fsApi.promises;

const heldLocks = new Set();

process.on('exit', () => heldLocks.forEach(release)); // A process killed without exiting leaves its lock behind, which the next taker detects as stale

export class WriterLockHeldError extends Error {
  constructor(lockFilePath, holderPid) {
    super(`Lock ${lockFilePath} is held by the process ${holderPid}`);
    this.name = 'WriterLockHeldError';
    this.lockFilePath = lockFilePath;
    this.holderPid = holderPid;
  }
}

export async function acquireWriterLock(lockFilePath) { // Held until the process exits; a process already holding the lock acquires it again silently
  try {
    await fs.writeFile(lockFilePath, String(process.pid), { flag: 'wx' }); // Exclusive creation, so that only one of two processes starting at the same time gets the lock
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }

    const { holderPid, writtenAt } = await read(lockFilePath);

    if (holderPid === process.pid) { // Left by a previous process that had the same PID, such as the same container restarted after a kill
      heldLocks.add(lockFilePath);

      return;
    }

    if (isAlive(holderPid) && writtenAt > Date.now() - os.uptime() * 1000) { // A lock written before the last boot is stale, even if its PID has since been reused by another process
      throw new WriterLockHeldError(lockFilePath, holderPid);
    }

    await takeOver(lockFilePath);

    return acquireWriterLock(lockFilePath);
  }

  heldLocks.add(lockFilePath);
}

async function read(lockFilePath) {
  try {
    const [ content, { mtimeMs }] = await Promise.all([ fs.readFile(lockFilePath, 'utf8'), fs.stat(lockFilePath) ]);

    return { holderPid: Number(content), writtenAt: mtimeMs };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    return { holderPid: null, writtenAt: 0 }; // The holder released the lock in the meantime, so it is taken over as a stale one
  }
}

async function takeOver(lockFilePath) {
  const staleLockFilePath = `${lockFilePath}.${process.pid}`;

  try {
    await fs.rename(lockFilePath, staleLockFilePath); // Atomic, so that only one of two processes taking over the same stale lock at the same time succeeds; the other finds the fresh lock of the winner when it retries
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.rm(staleLockFilePath, { force: true });
}

function release(lockFilePath) { // Synchronous, as asynchronous work is not run on exit
  let holder;

  try {
    holder = fsApi.readFileSync(lockFilePath, 'utf8');
  } catch {
    return; // Already released, for example along with the directory that held it
  }

  if (holder === String(process.pid)) { // Leave the lock to a process that took it over, which happens when the clock was set forward after this process wrote it
    fsApi.rmSync(lockFilePath, { force: true });
  }
}

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) { // An empty or corrupted lock file, left by a process killed while creating it
    return false;
  }

  try {
    process.kill(pid, 0); // Signal 0 only checks that the process exists

    return true;
  } catch (error) {
    return error.code === 'EPERM'; // The process exists but belongs to another user
  }
}
