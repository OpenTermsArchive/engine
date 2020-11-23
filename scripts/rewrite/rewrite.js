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

const EMPTY_TOS_BACK_CONTENT = `<!DOCTYPE html><html><head></head><body>

</body></html>`;

let history;
(async function () {
  console.time('Total time');
  const init = process.argv.includes('--init');

  const renamingRules = await loadRenamingRules();

  const sourceRepo = new Git(SNAPSHOTS_SOURCE_PATH);
  const commits = (await sourceRepo.log([ '--stat=4096' ])).sort((a, b) => new Date(a.date) - new Date(b.date));

  if (init) {
    const targetRepo = await initTargetRepo(SNAPSHOTS_TARGET_PATH);

    const [ readmeCommit ] = commits;
    await initReadmeAndLicense(targetRepo, readmeCommit.date);
  }

  history = await import(pathToFileURL(path.resolve(__dirname, '../..', 'src/app/history/index.js'))); // history module needs the target repo to be initiliazed. So loads it after target repo initialization.

  const filteredCommits = commits.filter(({ message }) => (message.match(/^(Start tracking|Update)/)));

  console.log(`Source repo contains ${commits.length} commits.\n`);

  const alreadyTrackedByCGus = {};

  const counters = {
    rewritten: 0,
    skippedNoChanges: 0,
    skippedEmptyContent: 0,
    skippedEmptyCommit: 0,
    skippedAlreadyTrackedByCGUs: 0,
  };

  /* eslint-disable no-await-in-loop */
  /* eslint-disable no-continue */
  for (const commit of filteredCommits) {
    console.log(Date.now(), commit.hash, commit.date, commit.message);

    await sourceRepo.checkout(commit.hash);

    if (!commit.diff) {
      console.log('⌙ Skip empty commit');
      counters.skippedEmptyCommit++;
      continue;
    }

    const [{ file: relativeFilePath }] = commit.diff.files;

    const { content, mimeType } = await loadFile(relativeFilePath);

    let serviceId = path.dirname(relativeFilePath);
    let documentType = path.basename(relativeFilePath, path.extname(relativeFilePath));

    if (!content || content == EMPTY_TOS_BACK_CONTENT) {
      console.log(`⌙ Skip empty document "${documentType}" of "${serviceId}" service`);
      counters.skippedEmptyContent++;
      continue;
    }

    const { renamedServiceId, renamedDocumentType } = applyRenamingRules(serviceId, documentType, renamingRules);
    serviceId = renamedServiceId;
    documentType = renamedDocumentType;

    if (commit.body.includes('Imported from')) { // The commit is from ToSBack import
      if (alreadyTrackedByCGus[serviceId] && alreadyTrackedByCGus[serviceId][documentType]) { // When documents are tracked in parallel by ToSBack and CGUs, keep only the CGUs' one.
        console.log(`⌙ Skip already tracked by CGUs ToSBack document "${documentType}" of "${serviceId}" service`);
        counters.skippedAlreadyTrackedByCGUs++;
        continue;
      }
    } else {
      alreadyTrackedByCGus[serviceId] = alreadyTrackedByCGus[serviceId] || {};
      alreadyTrackedByCGus[serviceId][documentType] = true;
    }

    const { id: snapshotId } = await history.recordSnapshot({
      serviceId,
      documentType,
      content,
      mimeType,
      authorDate: commit.date,
      extraChangelogContent: commit.body,
    });

    if (snapshotId) {
      counters.rewritten++;
    } else {
      counters.skippedNoChanges++;
    }
  }

  const totalTreatedCommits = Object.values(counters).reduce((acc, value) => acc + value, 0);
  console.log(`\nCommits treated: ${totalTreatedCommits} on ${filteredCommits.length}`);
  console.log(`⌙ Commits rewritten: ${counters.rewritten}`);
  console.log(`⌙ Skipped not changed commits: ${counters.skippedNoChanges}`);
  console.log(`⌙ Skipped ToSBack commits already tracked by CGUs: ${counters.skippedAlreadyTrackedByCGUs}`);
  console.log(`⌙ Skipped empty content commits: ${counters.skippedEmptyContent}`);
  console.log(`⌙ Skipped empty commits: ${counters.skippedEmptyCommit}\n`);
  console.timeEnd('Total time');

  if (totalTreatedCommits != filteredCommits.length) {
    console.error('\n⚠ WARNING: Total treated commits does not match the total number of commits to be treated! ⚠');
  }
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
  return new Git(targetRepoPath); // Re-intanciation of the target repo after initialization is required to ensure configuration made in the Git class is properly done.
}

async function loadRenamingRules() {
  return {
    services: JSON.parse(await fs.readFile(path.resolve(__dirname, './renamingRules/services.json'))),
    documentTypes: JSON.parse(await fs.readFile(path.resolve(__dirname, './renamingRules/documentTypes.json'))),
    servicesDocumentTypes: JSON.parse(await fs.readFile(path.resolve(__dirname, './renamingRules/servicesDocumentTypes.json'))),
  };
}

async function loadFile(relativeFilePath) {
  const absoluteFilePath = `${SNAPSHOTS_SOURCE_PATH}/${relativeFilePath}`;

  const mimeType = mime.getType(absoluteFilePath);
  const readFileOptions = {};
  if (mimeType.startsWith('text/')) {
    readFileOptions.encoding = 'utf8';
  }
  return {
    content: await fs.readFile(absoluteFilePath, readFileOptions),
    mimeType,
  };
}

function applyRenamingRules(serviceId, documentType, renamingRules) {
  const renamedServiceId = renamingRules.services[serviceId];
  if (renamedServiceId) {
    console.log(`⌙ Rename service "${serviceId}" to "${renamedServiceId}"`);
    serviceId = renamedServiceId;
  }

  const renamedDocumentType = renamingRules.documentTypes[documentType];
  if (renamedDocumentType) {
    console.log(`⌙ Rename document type "${documentType}" to "${renamedDocumentType}" of "${serviceId}" service`);
    documentType = renamedDocumentType;
  }

  const renamedServiceDocumentType = renamingRules.servicesDocumentTypes[serviceId] && renamingRules.servicesDocumentTypes[serviceId][documentType];
  if (renamedServiceDocumentType) {
    console.log(`⌙ Specific rename document type "${documentType}" to "${renamedServiceDocumentType}" of "${serviceId}" service`);
    documentType = renamedServiceDocumentType;
  }

  return {
    renamedServiceId: serviceId,
    renamedDocumentType: documentType,
  };
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
