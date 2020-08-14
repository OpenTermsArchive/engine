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
import { assertValid, validateDocument } from './validation/validator.js';
import serviceSchema from './validation/service.schema.js';

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
const LOCAL_TOSBACK2_REPO = '../../tosdr/tosback2';
const TOSBACK2_WEB_ROOT = 'https://github.com/tosdr/tosback2';
const TOSBACK2_RULES_FOLDER_NAME = 'rules';
const POSTGRES_URL = 'postgres://localhost/phoenix_development';

const services = {};
const urlAlreadyCovered = {};

function getLocalRulesFolder() {
  return path.join(LOCAL_TOSBACK2_REPO, TOSBACK2_RULES_FOLDER_NAME);
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
    if (i === str) {
      found = i;
      break;
    }
  }
  if (!found) {
    throw new Error(`Unsupported type: ${str}`);
  }
  return found;
}

async function process(serviceName, docName, url, xpath, importedFrom) {
  if (urlAlreadyCovered[url]) {
    return;
  }
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
  } catch (e) {
    console.log('error importing row', serviceName, docName, url, xpath, e.message);
  }
}

async function processTosback2(importedFrom, imported) {
  if (!Array.isArray(imported.sitename.docname)) {
    imported.sitename.docname = [ imported.sitename.docname ];
  }
  const serviceName = toPascalCase(imported.sitename.name.split('.')[0]);
  const promises = imported.sitename.docname.map(async docnameObj => process(serviceName, docnameObj.name, docnameObj.url.name, docnameObj.url.xpath, importedFrom).catch(e => {
    console.log('Could not process', serviceName, docnameObj.name, docnameObj.url.name, docnameObj.url.xpath, importedFrom, e.message);
  }));
  return Promise.all(promises);
}

async function parseAllGitXml(folder) {
  const git = simpleGit(folder);
  const gitLog = await git.log();
  const commitHash = gitLog.latest.hash;

  const files = await fs.readdir(folder);
  const promises = files.map(async filename => {
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
  await Promise.all(res.rows.map(row => process(row.service, row.name, row.url, row.xpath)));
  await client.end();
}

async function trySave(i) {
  if (Object.keys(services[i].documents).length) {
    try {
      assertValid(serviceSchema, services[i]);
      return fs.writeFile(path.join(SERVICES_PATH, i), `${JSON.stringify(services[i], null, 2)}\n`);
    } catch (e) {
      console.error('Could not save', e);
    }
  }
}

async function saveAllServices() {
  const promises = Object.keys(services).map(trySave);
  await Promise.all(promises);
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

async function run(includeXml, includePsql) {
  await readExistingServices();
  // Save all files once per minute while the script runs:
  const timer = setInterval(saveAllServices, 60000);

  if (includeXml) {
    await parseAllGitXml(getLocalRulesFolder());
  }
  if (includePsql) {
    await parseAllPg(POSTGRES_URL, services);
  }
  // Save all files once more at the end:
  clearInterval(timer);
  await saveAllServices();
}

// Edit this line to run the Tosback / ToS;DR import(s) you want:
run(true, false);
