import fsApi from 'fs';
import path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import parser from 'xml2json';
// eslint-disable-next-line import/no-extraneous-dependencies
import xPathToCss from 'xpath-to-css';
import simpleGit from 'simple-git';
import { createRequire } from 'module';
// eslint-disable-next-line import/no-extraneous-dependencies
import pg from 'pg';
// eslint-disable-next-line import/no-extraneous-dependencies
import pQueue from 'p-queue';
import { assertValid, validateDocument } from './validation/validator.js';
import serviceSchema from './validation/service.schema.js';

const PQueue = pQueue.default;
console.log(PQueue);

// FIXME: Somehow Node.js ESM doesn't recognize this export:
//
// import { Client } from 'pg';
// ^^^^^^
// SyntaxError: The requested module 'pg' does not provide an export named 'Client'
//
// But it does work:
const { Client } = pg;

const require = createRequire(import.meta.url);
const TYPES = require('../src/types.json');

const fs = fsApi.promises;

const SERVICES_PATH = './services/';
const LOCAL_TOSBACK2_REPO = '/Volumes/Workspace/tosback2';
const TOSBACK2_WEB_ROOT = 'https://github.com/tosdr/tosback2';
const TOSBACK2_RULES_FOLDER_NAME = 'rules';
const TOSBACK2_CRAWLS_FOLDER_NAME_1 = 'crawl_reviewed';
const TOSBACK2_CRAWLS_FOLDER_NAME_2 = 'crawl';
const POSTGRES_URL = 'postgres://localhost/phoenix_development';
const THREADS = 5;
const SNAPSHOTS_PATH = 'data/snapshots/';

const services = {};
const urlAlreadyCovered = {};

const HTML_PREFIX = '<!DOCTYPE html><html><head></head><body>\n';
const HTML_SUFFIX = '\n</body></html>';

const typesMap = {
  'API Terms of Use': 'Developer Terms',
  'APIs Terms of Use': 'Developer Terms',
  'Acceptable Use Policy': 'Terms of Service',
  'All Policies': 'Terms of Service',
  'Application-Based Services Terms of Use': 'Terms of Service',
  'Cable Internet Terms of Use': 'Terms of Service',
  'Canary Privacy Policy': 'Privacy Policy',
  'Cbs Interactive Privacy Policy': 'Privacy Policy',
  'Closed Captioning Policy': 'Closed Captioning Policy',
  'Conditions of Use': 'Terms of Service',
  'Consumer Terms of Sale': 'Terms of Service',
  'Cookie Policy': 'Cookies Policy',
  'Copyright and Your use of the British Library Website': 'Terms of Service',
  'Customer Privacy Policy': 'Privacy Policy',
  DMCA: 'Copyright Policy',
  'Data Policy': 'Privacy Policy',
  'Data Use Policy': 'Privacy Policy',
  EULA: 'Terms of Service',
  'Etiquette Policy': 'Community Guidelines',
  'Flickr Privacy Policy': 'Privacy Policy',
  'GOOGLE PRIVACY POLICY': 'Privacy Policy',
  'Gizmo Privacy Policy': 'Privacy Policy',
  'Host Guarantee Terms and Conditions': 'Seller Warranty',
  'Intellectual Property': 'Copyright Claims Policy',
  'Intellectual Property Policy': 'Copyright Claims Policy',
  'Legal Information (Intuit)': 'Legal Information',
  'LinkedIn in Microsoft Applications with Your Personal Account': 'Single Sign-On Policy',
  'Microsoft Services Agreement': 'Terms of Service',
  'Microsoft Terms of Use': 'Terms of Service',
  'Oath Privacy Center': 'Privacy Policy',
  'PRIVACY POLICY': 'Privacy Policy',
  Privacy: 'Privacy Policy',
  'Privacy Notice': 'Privacy Policy',
  'Privacy Policy Agreement': 'Privacy Policy',
  'Privacy Policy and Terms of Use': 'Terms of Service',
  'Privacy and Cookies Policy': 'Privacy Policy',
  'Privacy for eero Devices': 'Privacy Policy',
  'Rules on Resolving Image Piracy Complaints': 'Copyright Claims Policy',
  'SAMSUNG PRIVACY POLICY FOR THE U.S.': 'Privacy Policy',
  Security: 'Vulnerability Disclosure Policy',
  'Security & Privacy': 'Privacy Policy',
  'Security Advisory': 'Vulnerability Disclosure Policy',
  'Signal Terms & Privacy Policy': 'Terms of Service',
  'Term of Service': 'Terms of Service',
  Terms: 'Terms of Service',
  'Terms & Conditions': 'Terms of Service',
  'Terms Of Use': 'Terms of Service',
  'Terms and Conditions and Privacy Policy': 'Terms of Service',
  'Terms and Conditions of Use': 'Terms of Service',
  'Terms of Sale': 'Terms of Service',
  'Terms of Service & Privacy Policy': 'Terms of Service',
  'Terms of Service 1': 'Terms of Service',
  'Terms of Service and License Agreement': 'Terms of Service',
  'Terms of Service and Privacy': 'Terms of Service',
  'Terms of Use (Consumer)': 'Terms of Service',
  'Terms of Use - About Copyright': 'Terms of Service',
  'Terms of Use and Privacy Policy': 'Terms of Service',
  '"Third Party Advertising': ' Third Party Cookies',
  'Universal Terms Of Service': 'Terms of Service',
  'Visitor Agreement': 'Terms of Service',
  'Vunerability Disclosure Program': 'Vulnerability Disclosure Policy',
  'Web Notices and Terms of Use': 'Terms of Service',
  'Website Terms of Service': 'Terms of Service',
  'World Of Warcraft Terms Of Use Agreement': 'Terms of Service',
  'YOUR PRIVACY & SECURITY': 'Privacy Policy',
  'end-user-license-agreement': 'Terms of Service'
};

function translateSnapshotPath(serviceName, fileName) {
  const map = {
    'google.com/Terms of Service.txt': 'Google/Terms of Service.html',
    'google.com/Privacy Policy.txt': 'Google/Privacy Policy.html'
  };
  return map[`${serviceName}/${fileName}`];
}

function getLocalRulesFolder() {
  return path.join(LOCAL_TOSBACK2_REPO, TOSBACK2_RULES_FOLDER_NAME);
}

function getLocalCrawlsFolders() {
  return [
    TOSBACK2_CRAWLS_FOLDER_NAME_1,
    TOSBACK2_CRAWLS_FOLDER_NAME_2
  ];
}

function getGitHubWebUrl(commitHash, filename) {
  return [
    TOSBACK2_WEB_ROOT,
    'blob',
    commitHash,
    TOSBACK2_RULES_FOLDER_NAME,
    filename
  ].join('/');
}

async function parseFile(filename) {
  const data = await fs.readFile(filename);
  return parser.toJson(data);
}

function toPascalCase(str) {
  const lowerCase = str.toLowerCase();
  return str[0].toUpperCase() + lowerCase.substring(1);
}

function toType(str) {
  let found;
  for (const i in TYPES) {
    if ((i === str) || (i === typesMap[str])) {
      found = i;
      break;
    }
  }
  if (!found) {
    throw new Error(`Unsupported type: ${str}`);
  }
  return found;
}

const queue = new PQueue({ concurrency: THREADS });

async function processWhenReady(serviceName, docName, url, xpath, importedFrom) {
  console.log(serviceName, docName, 'queued');
  queue.add(() => process(serviceName, docName, url, xpath, importedFrom));
}

const pending = {};
async function process(serviceName, docName, url, xpath, importedFrom) {
  console.log(serviceName, docName, 'start');
  if (urlAlreadyCovered[url]) {
    console.log(serviceName, docName, 'skip');
    return;
  }
  pending[`${serviceName} - ${docName} - ${url}`] = true;
  const fileName = `${serviceName}.json`;
  if (!services[fileName]) {
    services[fileName] = {
      name: serviceName,
      importedFrom,
      documents: {}
    };
  }
  try {
    const type = toType(docName);
    if (services[fileName].documents[type]) {
      throw new Error('Same type used twice!');
    }
    const docObj = {
      fetch: url,
      select: (xpath ? xPathToCss(xpath) : 'body')
    };
    const validationResult = await validateDocument(docObj, []);
    if (validationResult.ok) {
      services[fileName].documents[type] = docObj;
    }
    await trySave(fileName);
    console.log(serviceName, docName, 'done');
  } catch (e) {
    console.log(serviceName, docName, 'fail');
  }
  delete pending[`${serviceName} - ${docName} - ${url}`];
  console.log('Pending:', Object.keys(pending));
}

async function processTosback2(importedFrom, imported) {
  if (!Array.isArray(imported.sitename.docname)) {
    imported.sitename.docname = [ imported.sitename.docname ];
  }
  const serviceName = toPascalCase(imported.sitename.name.split('.')[0]);
  const promises = imported.sitename.docname.map(async docnameObj => processWhenReady(serviceName, docnameObj.name, docnameObj.url.name, docnameObj.url.xpath, importedFrom).catch(e => {
    console.log('Could not process', serviceName, docnameObj.name, docnameObj.url.name, docnameObj.url.xpath, importedFrom, e.message);
  }));
  return Promise.all(promises);
}

function getTosbackGit() {
  return simpleGit({
    baseDir: LOCAL_TOSBACK2_REPO,
    binary: 'git',
    maxConcurrentProcesses: 6,
  });
}
function getSnapshotGit() {
  return simpleGit({
    baseDir: SNAPSHOTS_PATH,
    binary: 'git',
    maxConcurrentProcesses: 6,
  });
}

async function parseAllGitXml(folder, only) {
  const git = getTosbackGit();
  const gitLog = await git.log();
  const commitHash = gitLog.latest.hash;

  const files = await fs.readdir(folder);
  const promises = files.map(async filename => {
    if (only && filename !== `${only}.xml`) {
      // console.log(`Skipping ${filename}, only looking for ${only}.xml.`);
      return;
    }
    let imported;
    try {
      imported = JSON.parse(await parseFile(path.join(folder, filename)));
    } catch (e) {
      console.error('Error parsing xml', filename, e.message);
      return;
    }
    await processTosback2(getGitHubWebUrl(commitHash, filename), imported);
  });
  await Promise.all(promises);
}

async function parseAllPg(connectionString) {
  const client = new Client({
    connectionString
  });
  await client.connect();
  const res = await client.query('SELECT d.name, d.xpath, d.url, s.url as domains, s.name as service from documents d inner join services s on d.service_id=s.id');
  await Promise.all(res.rows.map(row => processWhenReady(row.service, row.name, row.url, row.xpath)));
  await client.end();
}

const couldNotRead = {};
const tosbackGitSemaphore = new PQueue({ concurrency: 1 });
const snapshotGitSemaphore = new PQueue({ concurrency: 1 });

async function importCrawl(fileName, foldersToTry, domainName) {
  const tosbackGit = getTosbackGit();
  const snapshotGit = getSnapshotGit();

  const filePath1 = path.join(foldersToTry[0], domainName, fileName);
  const filePath2 = path.join(foldersToTry[1], domainName, fileName);
  console.log('filePath', filePath1);
  let thisFileCommits;
  await tosbackGitSemaphore.add(async () => {
    console.log('Tosback2 git checkout master');
    await tosbackGit.checkout('master');
    console.log('Tosback2 git pull');
    await tosbackGit.pull();
    // This will set the --follow flag, see:
    // https://github.com/steveukx/git-js/blob/80741ac/src/git.js#L891
    const gitLog = await tosbackGit.log({ file: filePath1 });
    thisFileCommits = gitLog.all.reverse();
    console.log(fileName, thisFileCommits);
    const commitPromises = thisFileCommits.map(async commit => {
      let html;
      await tosbackGitSemaphore.add(async () => {
        console.log('tosback git checkout', commit.hash);
        await tosbackGit.checkout(commit.hash);
        console.log('Reading file', path.join(LOCAL_TOSBACK2_REPO, filePath1), commit.hash);
        let fileTxtAtCommit;
        let sourceUrl;
        try {
          fileTxtAtCommit = await fs.readFile(path.join(LOCAL_TOSBACK2_REPO, filePath1));
          sourceUrl = `https://github.com/tosdr/tosback2/blob/${commit.hash}/${filePath1}`;
        } catch (e) {
          console.log('Retrying to load file at', filePath2, commit.hash);
          try {
            fileTxtAtCommit = await fs.readFile(path.join(LOCAL_TOSBACK2_REPO, filePath2));
            sourceUrl = `https://github.com/tosdr/tosback2/blob/${commit.hash}/${filePath2}`;
          } catch (e) {
            if (!couldNotRead[commit.hash]) {
              couldNotRead[commit.hash] = [];
            }
            couldNotRead[commit.hash].push(filePath1);
            console.log('Could not load, skipping', couldNotRead);
          }
        }
        html = HTML_PREFIX + fileTxtAtCommit + HTML_SUFFIX;
        await snapshotGitSemaphore.add(async () => {
          const destPath = path.join(SNAPSHOTS_PATH, translateSnapshotPath(domainName, fileName));
          console.log('saving', destPath);
          const containingDir = path.dirname(destPath);
          await fs.mkdir(containingDir, { recursive: true });
          await fs.writeFile(destPath, html);
          console.log('committing', destPath, `From tosback2 ${commit.hash}`);
          await snapshotGit.add('.');
          await snapshotGit.commit(`${translateSnapshotPath(domainName, fileName)} from tosback2@${commit.hash.substring(0, 7)}\n\nImported from ${sourceUrl}`, [ '-a', `--date="${commit.date}"` ]);
        });
      });
      await Promise.all(commitPromises);
      console.log('Setting Tosback2 repo back to master');
      await tosbackGit.checkout('master');
    });
  });
}

async function importCrawls(foldersToTry, only) {
  console.log('Tosback2 gathering domain names');
  const domainNames = await fs.readdir(path.join(LOCAL_TOSBACK2_REPO, foldersToTry[0]));
  const domainPromises = domainNames.map(async domainName => {
    if (only && domainName !== only) {
      // console.log(`Skipping ${domainName}, only looking for ${only}.`);
      return;
    }
    console.log('Found!', domainName);
    const fileNames = await fs.readdir(path.join(LOCAL_TOSBACK2_REPO, foldersToTry[0], domainName));
    const filePromises = fileNames.map(fileName => importCrawl(fileName, foldersToTry, domainName));
    return Promise.all(filePromises);
  });
  await Promise.all(domainPromises);
}

async function trySave(i) {
  console.log('Saving', path.join(SERVICES_PATH, i));
  if (Object.keys(services[i].documents).length) {
    try {
      assertValid(serviceSchema, services[i]);
      const fileName = path.join(SERVICES_PATH, i);
      const containingDir = path.dirname(fileName);
      await fs.mkdir(containingDir, { recursive: true });
      await fs.writeFile(fileName, `${JSON.stringify(services[i], null, 2)}\n`);
      // await new Promise(resolve => setTimeout(resolve, 100));
      console.log('Saved', path.join(SERVICES_PATH, i));
    } catch (e) {
      console.error('Could not save', e);
    }
  }
}

async function readExistingServices() {
  const serviceFiles = await fs.readdir(SERVICES_PATH);
  await Promise.all(serviceFiles.filter(x => x.endsWith('.json')).map(async serviceFile => {
    const content = JSON.parse(await fs.readFile(path.join(SERVICES_PATH, serviceFile)));
    services[serviceFile] = content;
    Object.keys(content.documents).forEach(x => {
      const url = content.documents[x].fetch;
      if (!urlAlreadyCovered[url]) {
        urlAlreadyCovered[url] = [];
      }
      urlAlreadyCovered[url].push({
        service: content.name,
        docType: x,
        select: content.documents[x].select
      });
    });
  }));
  return urlAlreadyCovered;
}

async function run(includeXml, includePsql, includeCrawls, only) {
  await readExistingServices();

  if (includeXml) {
    await parseAllGitXml(getLocalRulesFolder(), only);
  }
  if (includePsql) {
    await parseAllPg(POSTGRES_URL, services);
  }
  if (includeCrawls) {
    await importCrawls(getLocalCrawlsFolders(), only);
  }
}

// Edit this line to run the Tosback rules / ToS;DR rules / Tosback crawls import(s) you want:
run(false, false, true, 'google.com');
