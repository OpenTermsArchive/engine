import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

import async from 'async';
import config from 'config';
import mime from 'mime';
import { MongoClient } from 'mongodb';
import nodeFetch from 'node-fetch';

import Git from '../../src/archivist/recorder/repositories/git/git.js';
import * as renamer from '../utils/renamer/index.js';

import logger from './logger/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_PATH = path.resolve(__dirname, '../../');
const MAX_PARALLEL = 10;
const MAX_RETRY = 5;
const PDF_MIME_TYPE = mime.getType('pdf');
const COUNTERS = {
  imported: 0,
  skippedNoChanges: 0,
  errors: 0,
};
const commitsNotImported = [];

let sourceRepository;
let snapshotsCollection;
let commitsCollection;
let client;

(async function main() {
  console.time('Total time');
  logger.info({ message: 'Start importing…' });

  await initialize();

  const totalToTreat = await commitsCollection.find().count();

  const queue = async.queue(queueWorker, MAX_PARALLEL);

  queue.error(queueErrorHandler);
  queue.drain(queueDrainHandler(totalToTreat));

  let counter = 1;

  await commitsCollection.find().forEach(commit => {
    queue.push({ commit, index: counter, total: totalToTreat });
    counter++;
  });
}());

async function initialize() {
  client = new MongoClient(config.get('import.mongo.connectionURI'));

  await client.connect();
  const db = client.db(config.get('import.mongo.database'));

  snapshotsCollection = db.collection(config.get('import.mongo.snapshotsCollection'));
  commitsCollection = db.collection(config.get('import.mongo.commitsCollection'));

  sourceRepository = new Git({ path: path.resolve(ROOT_PATH, config.get('import.sourcePath')) });

  await sourceRepository.initialize();
  await renamer.loadRules();
}

function queueWorker({ commit, index, total }) {
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
  const termsType = path.basename(relativeFilePath, extension);

  commitsNotImported.push(commit.hash);
  logger.error({ message: `${error.stack}\nCommit details: ${JSON.stringify(commit, null, 2)}`, serviceId, type: termsType, sha: commit.hash });
  COUNTERS.errors++;
}

function queueDrainHandler(totalToTreat) {
  return () => {
    const totalTreatedCommits = Object.values(COUNTERS).reduce((acc, value) => acc + value, 0);

    console.log(`\nEntries treated: ${totalTreatedCommits} on ${totalToTreat}`);
    console.log(`⌙ Entries imported: ${COUNTERS.imported}`);
    console.log(`⌙ Entries skipped (already on the database): ${COUNTERS.skippedNoChanges}`);
    console.log(`⌙ Entries with errors: ${COUNTERS.errors}`);
    console.timeEnd('Total time');

    if (totalTreatedCommits != totalToTreat) {
      console.error('\n⚠ WARNING: Total treated entries does not match the total number of entries to be treated! ⚠');
    }

    if (commitsNotImported.length) {
      console.log('Not imported commits:\n');
      console.log(commitsNotImported);
    }

    client.close();
  };
}

async function getCommitContent({ sha, serviceId, termsType, extension }) {
  const start = performance.now();
  const url = `https://raw.githubusercontent.com/${config.get('import.githubRepository')}/${sha}/${encodeURI(serviceId)}/${encodeURI(termsType)}.${extension}`;
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

  logger.info({ message: `Fetched in ${Number(end - start).toFixed(2)} ms`, serviceId, type: termsType, sha });

  return content;
}

async function handleCommit(commit, index, total) {
  const [{ file: relativeFilePath }] = commit.diff.files;

  let serviceId = path.dirname(relativeFilePath);
  const extension = path.extname(relativeFilePath);
  let termsType = path.basename(relativeFilePath, extension);

  logger.info({
    message: 'Start to handle commit',
    serviceId,
    type: termsType,
    sha: commit.hash,
    current: index + 1,
    total,
  });

  const alreadyExistsRecord = await snapshotsCollection.findOne({ '_importMetadata.commitSHA': commit.hash });

  if (alreadyExistsRecord) {
    logger.info({
      message: 'Skipped commit as an entry already exists for this commit',
      serviceId,
      type: termsType,
      sha: commit.hash,
    });
    COUNTERS.skippedNoChanges++;

    return;
  }

  let content = await getCommitContent({ sha: commit.hash, serviceId, termsType, extension: extension.replace('.', '') });

  ({ serviceId, termsType } = renamer.applyRules(serviceId, termsType));

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

    await snapshotsCollection.insertOne({
      serviceId,
      termsType,
      content,
      mimeType,
      fetchDate: commit.date,
      _importMetadata,
      created_at: new Date(),
    });
    const end = performance.now();

    logger.info({ message: `Recorded in ${Number(end - start).toFixed(2)} ms`, serviceId, type: termsType });
    COUNTERS.imported++;
  } catch (error) {
    logger.error({ message: `Not saved: ${commit.date} ${error.stack}`, serviceId, type: termsType });
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
