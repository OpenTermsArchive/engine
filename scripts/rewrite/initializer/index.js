import fsApi from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';

import Git from '../../../src/archivist/recorder/repositories/git/git.js';
import { fileExists } from '../utils.js';

const fs = fsApi.promises;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const README_PATH = path.resolve(__dirname, './files/readme.md');
const LICENSE_PATH = path.resolve(__dirname, './files/license');

export async function initReadmeAndLicense(targetRepo, targetPath, authorDate) {
  const targetReadmeFilePath = path.resolve(targetPath, 'README.md');
  const targetLicenseFilePath = path.resolve(targetPath, 'LICENSE');

  await fs.copyFile(README_PATH, targetReadmeFilePath);
  await fs.copyFile(LICENSE_PATH, targetLicenseFilePath);
  await targetRepo.add(targetReadmeFilePath);
  await targetRepo.add(targetLicenseFilePath);
  await targetRepo.commit({
    message: 'Add readme and license',
    date: authorDate,
  });
}

export async function initTargetRepo(targetRepoPath) {
  console.log('Initializing target repository');

  if (await fileExists(targetRepoPath)) {
    console.log(`Removed already existing target repository: ${targetRepoPath}`);
    await fs.rm(targetRepoPath, { recursive: true });
  }
  await fs.mkdir(targetRepoPath);

  const targetRepo = await new Git({ path: targetRepoPath, author: config.get('@opentermsarchive/engine.recorder.versions.storage.git.author') });

  await targetRepo.initialize();

  return targetRepo;
}
