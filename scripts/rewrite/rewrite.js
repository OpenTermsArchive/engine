import fsApi from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

import config from 'config';
import mime from 'mime';

import Git from '../../src/app/history/git.js';

const fs = fsApi.promises;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SNAPSHOTS_SOURCE_PATH = path.resolve(__dirname, '../../', config.get('rewrite.snapshotsSourcePath'));
export const SNAPSHOTS_TARGET_PATH = path.resolve(__dirname, '../../', config.get('history.snapshotsPath'));

const README_PATH = path.resolve(__dirname, './initFiles/snapshot-readme.md');
const LICENSE_PATH = path.resolve(__dirname, './initFiles/snapshot-license');

let history;
(async function () {
  console.time('Total time');
  const init = process.argv.includes('--init');

  const servicesRenamingRules = JSON.parse(await fs.readFile(path.resolve(__dirname, './rules/servicesRenaming.json')));
  const documentTypesRenamingRules = JSON.parse(await fs.readFile(path.resolve(__dirname, './rules/documentTypeRenaming.json')));
  const serviceDocumentTypesRenamingRules = JSON.parse(await fs.readFile(path.resolve(__dirname, './rules/serviceDocumentTypeRenaming.json')));

  const sourceRepo = new Git(SNAPSHOTS_SOURCE_PATH);
  const commits = (await sourceRepo.log([ '--stat=4096' ])).sort((a, b) => new Date(a.date) - new Date(b.date));

  if (init) {
    const targetRepo = await initTargetRepo(SNAPSHOTS_TARGET_PATH);

    const [ readmeCommit ] = commits;
    await initReadmeAndLicense(targetRepo, readmeCommit.date);
  }

  history = await import(pathToFileURL(path.resolve(__dirname, '../..', 'src/app/history/index.js'))); // history module needs the target repo to be initiliazed. So loads it after target repo initialization.

  const filteredCommits = commits.filter(({ message }) => (message.includes('Start tracking') || message.includes('Update')));

  console.log(`Source repo contains ${filteredCommits.length} commits.\n`);

  let totalRewritten = 0;
  let totalNotChanged = 0;
  /* eslint-disable no-await-in-loop */
  for (const commit of filteredCommits) {
    console.log(Date.now(), commit.hash, commit.date, commit.message);

    await sourceRepo.checkout(commit.hash);

    const [{ file: relativeFilePath }] = commit.diff.files;
    const absoluteFilePath = `${SNAPSHOTS_SOURCE_PATH}/${relativeFilePath}`;

    const mimeType = mime.getType(absoluteFilePath);
    const readFileOptions = {};
    if (mimeType.startsWith('text/')) {
      readFileOptions.encoding = 'utf8';
    }
    const content = await fs.readFile(absoluteFilePath, readFileOptions);

    const [ serviceId ] = relativeFilePath.split('/');
    let documentType = path.basename(relativeFilePath, path.extname(relativeFilePath));

    if (serviceDocumentTypesRenamingRules[serviceId] && serviceDocumentTypesRenamingRules[serviceId][documentType]) {
      documentType = serviceDocumentTypesRenamingRules[serviceId][documentType];
      console.log(`⌙Specific rename document type "${documentType}" to "${serviceDocumentTypesRenamingRules[serviceId][documentType]}" of "${serviceId}" service`);
    }

    if (servicesRenamingRules[serviceId]) {
      console.log(`⌙Rename service "${serviceId}" to "${servicesRenamingRules[serviceId]}"`);
    }

    if (documentTypesRenamingRules[documentType]) {
      console.log(`⌙Rename document type "${documentType}" to "${documentTypesRenamingRules[documentType]}" of "${serviceId}" service`);
    }

    const { id: snapshotId } = await history.recordSnapshot({
      serviceId: servicesRenamingRules[serviceId] || serviceId,
      documentType: documentTypesRenamingRules[documentType] || documentType,
      content,
      mimeType,
      authorDate: commit.date
    });

    if (snapshotId) {
      totalRewritten++;
    } else {
      totalNotChanged++;
    }
  }
  console.log(`\n${totalRewritten} commits rewritten and ${totalNotChanged} not changed on ${filteredCommits.length} source commits.`);
  console.timeEnd('Total time');
}());

async function initReadmeAndLicense(targetRepo, authorDate) {
  const targetReadmeFilePath = path.resolve(SNAPSHOTS_TARGET_PATH, 'README.md');
  const targetLicenseFilePath = path.resolve(SNAPSHOTS_TARGET_PATH, 'LICENSE');
  await fs.copyFile(README_PATH, targetReadmeFilePath);
  await fs.copyFile(LICENSE_PATH, targetLicenseFilePath);
  await targetRepo.add(targetReadmeFilePath);
  await targetRepo.add(targetLicenseFilePath);
  await targetRepo.commit(null, 'Add Readme and License', authorDate);
}

async function initTargetRepo(targetRepoPath) {
  console.log('Initializing target repository');

  if (await fileExists(targetRepoPath)) {
    console.log(`Removed already existing target repository: ${targetRepoPath}`);
    await fs.rmdir(targetRepoPath, { recursive: true });
  }
  await fs.mkdir(targetRepoPath);

  await new Git(targetRepoPath).init();
  await new Git(targetRepoPath).initUser();
  return new Git(targetRepoPath); // Resintanciation of the target repo after initialization is required to ensure configuration made in the Git class is properly done.
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
  }
}
