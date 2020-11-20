import * as fs from 'fs';
import Notifier from './notifier/index.js';

const notifier = new Notifier();

const content = fs.readFileSync('./test/fixtures/Twitter_PP.md').toString();
const documentDeclaration = {
  fetch: 'https://twitter.com/en/privacy'
};

async function run() {
  await notifier.saveToEditTosdrOrg({ content, documentDeclaration, snapshotId: '12345' });
  await notifier.end();
}

// ...
run();
