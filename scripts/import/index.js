import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

import async from 'async';
import config from 'config';
import mime from 'mime';
import { MongoClient } from 'mongodb';
import nodeFetch from 'node-fetch';

import Git from '../../src/storage-adapters/git/git.js';
import * as renamer from '../renamer/index.js';

import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_PATH = path.resolve(__dirname, '../../');
const MAX_PARALLEL = 10;
const MAX_RETRY = 5;
const PDF_MIME_TYPE = 'application/pdf';
const COUNTERS = {
  imported: 0,
  skippedNoChanges: 0,
  errors: 0,
};
const commitsNotImported = [];

let sourceRepository;
let collection;
let client;

(async function main() {
  console.time('Total time');
  logger.info({ message: 'Start importing…' });

  await initialize();

  logger.info({ message: 'Waiting for git log… (this can take a while)' });
  const start = performance.now();
  const commits = (await sourceRepository.log(['--stat=4096'])).sort((a, b) => new Date(a.date) - new Date(b.date));
  const end = performance.now();
  const filteredCommits = commits.filter(({ message }) => message.match(/^(Start tracking|Update)/));

  logger.info({ message: `Load git log in ${Number((end - start) / 1000).toFixed(2)} s` });
  logger.info({ message: `Source repo contains ${commits.length} commits.` });

  const numberOfSkippedCommits = commits.length - filteredCommits.length;

  if (numberOfSkippedCommits) {
    logger.info({ message: `Skip ${numberOfSkippedCommits} commits that do not need to be imported (Readme, licence, …).` });
  }

  const queue = async.queue(queueWorker, MAX_PARALLEL);

  queue.error(queueErrorHandler);
  queue.drain(queueDrainHandler(filteredCommits));

  filteredCommits.forEach(async (commit, index) => queue.push({ commit, index, total: filteredCommits.length }));
}());

async function queueWorker({ commit, index, total }) {
  return async.retry({
    times: MAX_RETRY,
    interval(retryCount) {
      return 1000 * 2 ** retryCount;
    },
  }, callback => {
    handleCommit(commit, index, total).then(() => {
      callback();
    }).catch(error => {
      callback(error);
    });
  });
}

function queueErrorHandler(error, { commit }) {
  const [{ file: relativeFilePath }] = commit.diff.files;

  const serviceId = path.dirname(relativeFilePath);
  const extension = path.extname(relativeFilePath);
  const documentType = path.basename(relativeFilePath, extension);

  commitsNotImported.push(commit.hash);
  logger.error({ message: `${error.stack}\nCommit details: ${JSON.stringify(commit, null, 2)}`, serviceId, type: documentType, sha: commit.hash });
  COUNTERS.errors++;
}

function queueDrainHandler(filteredCommits) {
  return () => {
    const totalTreatedCommits = Object.values(COUNTERS).reduce((acc, value) => acc + value, 0);

    console.log(`\nEntries treated: ${totalTreatedCommits} on ${filteredCommits.length}`);
    console.log(`⌙ Entries imported: ${COUNTERS.imported}`);
    console.log(`⌙ Entries skipped (already on the database): ${COUNTERS.skippedNoChanges}`);
    console.log(`⌙ Entries with errors: ${COUNTERS.errors}`);
    console.timeEnd('Total time');

    if (totalTreatedCommits != filteredCommits.length) {
      console.error('\n⚠ WARNING: Total treated entries does not match the total number of entries to be treated! ⚠');
    }

    if (commitsNotImported.length) {
      console.log('Not imported commits:\n');
      console.log(commitsNotImported);
    }

    client.close();
  };
}

async function initialize() {
  client = new MongoClient(config.get('import.mongo.connectionURI'));

  await client.connect();
  const db = client.db(config.get('import.mongo.database'));

  collection = db.collection(config.get('import.mongo.collection'));

  sourceRepository = new Git({ path: path.resolve(ROOT_PATH, config.get('import.sourcePath')) });

  await sourceRepository.initialize();
  await renamer.loadRules();
}

async function getCommitContent({ sha, serviceId, documentType, extension }) {
  const start = performance.now();
  const url = `https://raw.githubusercontent.com/${config.get('import.githubRepository')}/${sha}/${encodeURI(serviceId)}/${encodeURI(documentType)}.${extension}`;
  const response = await nodeFetch(url);
  const end = performance.now();

  let content;

  const mimeType = mime.getType(extension);

  if (mimeType == PDF_MIME_TYPE) {
    content = Buffer.from(await response.arrayBuffer());
  } else {
    content = await response.text();
  }

  if (response.status !== 200) {
    throw new Error(`Cannot get commit content on Github ${url}. Get HTTP Code ${response.status} and response ${content}`);
  }

  if (content == '429: Too Many Requests') {
    throw new TooManyRequestsError(`Cannot get commit content on Github ${url}. 429: Too Many Requests`);
  }

  logger.info({ message: `Fetched in ${Number(end - start).toFixed(2)} ms`, serviceId, type: documentType, sha });

  return content;
}

async function handleCommit(commit, index, total) {
  const [{ file: relativeFilePath }] = commit.diff.files;

  let serviceId = path.dirname(relativeFilePath);
  const extension = path.extname(relativeFilePath);
  let documentType = path.basename(relativeFilePath, extension);

  logger.info({
    message: 'Start to handle commit',
    serviceId,
    type: documentType,
    sha: commit.hash,
    current: index + 1,
    total,
  });

  const alreadyExistsRecord = await collection.findOne({ '_importMetadata.commitSHA': commit.hash });

  if (alreadyExistsRecord) {
    logger.info({
      message: 'Skipped commit as entry already exist for this commit',
      serviceId,
      type: documentType,
      sha: commit.hash,
    });
    COUNTERS.skippedNoChanges++;

    return;
  }

  let content = await getCommitContent({ sha: commit.hash, serviceId, documentType, extension: extension.replace('.', '') });

  ({ serviceId, documentType } = renamer.applyRules(serviceId, documentType));

  const mimeType = mime.getType(extension);

  if (mimeType == PDF_MIME_TYPE) {
    content = content.toString('utf-8'); // Serialize PDF
  }

  try {
    const _importMetadata = { commitSHA: commit.hash };

    if (commit.body.includes('tosback2')) {
      _importMetadata.provider = 'TOSBack.org';
      _importMetadata.url = commit.body?.match(/Imported from (.*)\nSnapshot/)[1];
    }

    const start = performance.now();

    await collection.insertOne({
      serviceId,
      documentType,
      content,
      mimeType,
      fetchDate: commit.date,
      _importMetadata,
      created_at: new Date(),
    });
    const end = performance.now();

    logger.info({ message: `Recorded in ${Number(end - start).toFixed(2)} ms`, serviceId, type: documentType });
    COUNTERS.imported++;
  } catch (error) {
    logger.error({ message: `Not saved: ${commit.date} ${error.stack}`, serviceId, type: documentType });
    commitsNotImported.push(commit.hash);
    COUNTERS.errors++;
  }
}

export class TooManyRequestsError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TooManyRequestsError';
  }
}
