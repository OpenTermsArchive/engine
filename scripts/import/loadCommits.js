import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

import config from 'config';
import { MongoClient } from 'mongodb';

import Git from '../../src/archivist/recorder/repositories/git/git.js';

import logger from './logger/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT_PATH = path.resolve(__dirname, '../../');

let sourceRepository;
let collection;
let client;

(async function main() {
  console.time('Total time');
  logger.info({ message: 'Start importing commits…' });

  await initialize();

  logger.info({ message: 'Waiting for git log… (this can take a while)' });
  const start = performance.now();
  const commits = (await sourceRepository.log(['--stat=4096'])).sort((a, b) => new Date(a.date) - new Date(b.date));
  const end = performance.now();
  const filteredCommits = commits.filter(({ message }) => message.match(/^(Start tracking|Update)/));

  logger.info({ message: `Loaded git log in ${Number((end - start) / 1000).toFixed(2)} s` });
  logger.info({ message: `Source repo contains ${commits.length} commits` });

  const totalCommitToLoad = filteredCommits.length;
  const numberOfSkippedCommits = commits.length - totalCommitToLoad;

  if (numberOfSkippedCommits) {
    logger.info({ message: `Skipped ${numberOfSkippedCommits} commits that do not need to be imported (README, LICENCE…).` });
  }

  let counter = 1;

  for (const commit of filteredCommits.reverse()) { // reverse array to insert most recent commits first
    await collection.updateOne({ hash: commit.hash }, { $set: { ...commit } }, { upsert: true }); // eslint-disable-line no-await-in-loop

    if (counter % 1000 == 0) {
      logger.info({ message: ' ', current: counter, total: totalCommitToLoad });
    }
    counter++;
  }

  await client.close();
}());

async function initialize() {
  client = new MongoClient(config.get('@opentermsarchive/engine.import.mongo.connectionURI'));

  await client.connect();
  const db = client.db(config.get('@opentermsarchive/engine.import.mongo.database'));

  collection = db.collection(config.get('@opentermsarchive/engine.import.mongo.commitsCollection'));
  sourceRepository = new Git({ path: path.resolve(ROOT_PATH, config.get('@opentermsarchive/engine.import.sourcePath')) });

  await sourceRepository.initialize();
}
