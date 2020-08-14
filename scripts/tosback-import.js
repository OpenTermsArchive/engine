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

import fetch from '../src/fetcher/index.js';
import filter from '../src/filter/index.js';

// FIXME: Somehow Node.js ESM doesn't recognize this export:
//
// import { Client } from 'pg';
// ^^^^^^
// SyntaxError: The requested module 'pg' does not provide an export named 'Client'
//
// But it does work:
const { Client } = pg;

import { assertValid, validateDocument } from './validation/validator.js';
import serviceSchema from './validation/service.schema.js';

const require = createRequire(import.meta.url);
const TYPES = require('../src/types.json');

const fs = fsApi.promises;

const SERVICES_PATH = './services/';
const LOCAL_TOSBACK2_REPO = '../../tosdr/tosback2';
const TOSBACK2_WEB_ROOT = 'https://github.com/tosdr/tosback2';
const TOSBACK2_RULES_FOLDER_NAME = 'rules';
const DEFAULT_POSTGRES_URL = 'postgres://localhost/phoenix_development';

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

async function parseTosback2(importedFrom, imported) {
  if (!Array.isArray(imported.sitename.docname)) {
    imported.sitename.docname = [imported.sitename.docname];
  }
  const siteName = toPascalCase(imported.sitename.name.split('.')[0]);
  const documents = {};
  const promises = imported.sitename.docname.map(async docnameObj => {
    const type = toType(docnameObj.name);
    if (documents.type) {
      throw new Error('Same type used twice!');
    }
    const docObj = {
      fetch: docnameObj.url.name
    };

    try {
      docObj.select = xPathToCss(docnameObj.url.xpath);
    } catch (e) {
      if (docnameObj.url.xpath) {
        console.error('XPath-to-CSS failed:', docnameObj.url.xpath);
      }
      throw e;
    }
    const validationResult = await validateDocument(docObj, []);
    if (validationResult.ok) {
      documents[type] = docObj;
    }
  });
  // NB: if one doc spec import fails, the whole service spec import fails:
  await Promise.all(promises);
  const declaration = {
    importedFrom,
    name: siteName,
    documents
  };
  assertValid(serviceSchema, declaration);
  return declaration;
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
    console.log('imported', filename, JSON.stringify(imported, null, 2));
    let declaration;
    try {
      declaration = await parseTosback2(getGitHubWebUrl(commitHash, filename), imported);
    } catch (e) {
      console.error('Error parsing tosback2 object:', e.message);
      return;
    }
    console.log('Got declaration', declaration);
    if (declaration && declaration.name && Object.keys(declaration.documents).length) {
      try {
        await fs.writeFile(path.join(servicesPath, `${declaration.name}.json`), JSON.stringify(declaration, null, 2));
      } catch (e) {
        console.error('Error saving service declaration:', e);
      }
    }
  });
  await Promise.all(promises);
}

async function process(row, documents) {
  if (documents[row.url]) {
    // console.log('exists!', row.url);
    return;
  }
  const fileName = path.join(SERVICES_PATH, `${row.service}.json`);
  let content;
  try {
    content = JSON.parse(await fs.readFile(fileName));
  } catch (e) {
    content = {
      name: row.service,
      documents: {}
    };
  }
  try {
    const type = toType(row.name);
    if (documents.type) {
      throw new Error('Same type used twice!');
    }
    const docObj = {
      fetch: row.url,
      select: xPathToCss(row.xpath)
    };  
    const valid = await validDocObj(docObj);
    if (valid) {
      documents[type] = docObj;
    }
  await fs.writeFile(fileName, JSON.stringify(content, null, 2));
  console.log('Updated', fileName);
}

async function parseAllPg(connectionString, services) {
  const client = new Client({
    connectionString
  });
  await client.connect();
  const res = await client.query('SELECT d.name, d.xpath, d.url, s.url as domains, s.name as service from documents d inner join services s on d.service_id=s.id');
  await Promise.all(res.rows.map(row => process(row, services)));
  await client.end();
}

async function readExistingServices() {
  const documents = {};
  const serviceFiles = await fs.readdir(SERVICES_PATH);
  await Promise.all(serviceFiles.filter(x => x.endsWith('.json')).map(async serviceFile => {
    const content = JSON.parse(await fs.readFile(path.join(SERVICES_PATH, serviceFile)));
    Object.keys(content.documents).forEach(x => {
      const url = content.documents[x].fetch;
      if (!documents[url]) {
        documents[url] = [];
      }
      documents[url].push({
        service: content.name,
        docType: x,
        select: content.documents[x].select
      });
    });
  }));
  return documents;
}

async function run() {
  const services = await readExistingServices();
  // await parseAllGitXml(getLocalRulesFolder());
  await parseAllPg(DEFAULT_POSTGRES_URL, services);
}
run();
