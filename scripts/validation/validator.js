// eslint-disable-next-line import/no-extraneous-dependencies
import Ajv from 'ajv';
// eslint-disable-next-line import/no-extraneous-dependencies
import jsonSourceMap from 'json-source-map';

import fetch from '../../src/fetcher/index.js';
import filter from '../../src/filter/index.js';

const MIN_DOC_LENGTH = 100;
const TIMEOUT = 10000;

const validator = new Ajv({
  allErrors: true,
  jsonPointers: true,
});

export function assertValid(schema, subject) {
  const valid = validator.validate(schema, subject);

  if (!valid) {
    const errorPointers = new Set();
    let errorMessage = '';
    const sourceMap = jsonSourceMap.stringify(subject, null, 2);
    const jsonLines = sourceMap.json.split('\n');
    validator.errors.forEach(error => {
      errorMessage += `\n\n${validator.errorsText([error])}`;
      const errorPointer = sourceMap.pointers[error.dataPath];
      if (errorPointer) {
        errorMessage += `\n> ${jsonLines.slice(errorPointer.value.line, errorPointer.valueEnd.line).join('\n> ')}`;
        errorPointers.add(errorPointer);
      } else {
        errorMessage += ' (in entire file)\n';
      }
    });

    errorMessage += `\n\n${errorPointers.size} features have errors in total`;

    throw new Error(errorMessage);
  }
}

function isLongEnough(docText) {
  // FIXME: "n [...] computed once as a fraction of the minimum size of all currently tracked documents."
  // See https://github.com/ambanum/CGUs/issues/59
  return (docText.length > MIN_DOC_LENGTH);
}
const NEGATIVE_RESULT = {
  fetchable: false,
  selectorMatchesAnElement: false,
  hasConsistentFilteredContent: false,
  isLongEnough: false,
  ok: false
};

async function validateDocumentImpl(docObj, filters) {
  const result = { ...NEGATIVE_RESULT };
  const { fetch: location } = docObj;
  const content = await fetch(location).catch(() => {
    throw new Error(`Could not fetch ${location}`);
  });
  result.fetchable = true;
  const filteredContent = [];
  filteredContent[0] = await filter(content, docObj, filters).catch(() => {
    throw new Error(`Could not filter ${location}`);
  });;
  result.selectorMatchesAnElement = (filteredContent[0].length > 0);
  result.isLongEnough = isLongEnough(filteredContent[0]);
  const content2 = await fetch(location).catch(() => {
    throw new Error(`Could not fetch second time ${location}`);
  });
  filteredContent[1] = await filter(content2, docObj, filters).catch(() => {
    throw new Error(`Could not filter second time ${location}`);
  });
  result.hasConsistentFilteredContent = (filteredContent[0] === filteredContent[1]);
  result.ok = result.fetchable && result.selectorMatchesAnElement && result.hasConsistentFilteredContent && result.isLongEnough;
  return result;
}

export async function validateDocument(docObj, filters) {
  return Promise.race([
    new Promise(resolve => {
      setTimeout(() => {
        resolve(NEGATIVE_RESULT);
      }, TIMEOUT);
    }),
    validateDocumentImpl(docObj, filters).catch(e => console.error(e.message))
  ]);
}