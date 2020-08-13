import fsApi from 'fs';
import path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import parser from 'xml2json';
// eslint-disable-next-line import/no-extraneous-dependencies
import xPathToCss from 'xpath-to-css';
import simpleGit from 'simple-git';
import { createRequire } from 'module';
import { assertValid, validateDocument } from './validation/validator.js';
import serviceSchema from './validation/service.schema.js';

const require = createRequire(import.meta.url);
const TYPES = require('../src/types.json');

const fs = fsApi.promises;

const LOCAL_TOSBACK2_REPO = '../../tosdr/tosback2';
const TOSBACK2_WEB_ROOT = 'https://github.com/tosdr/tosback2';
const TOSBACK2_RULES_FOLDER_NAME = 'rules';

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

async function parseAll(folder) {
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
        await fs.writeFile(`services/${declaration.name}.json`, JSON.stringify(declaration, null, 2));
      } catch (e) {
        console.error('Error saving service declaration:', e);
      }
    }
  });
  await Promise.all(promises);
}

parseAll(getLocalRulesFolder());
