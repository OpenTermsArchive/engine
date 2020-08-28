import fsApi from 'fs';
import path from 'path';

import Ajv from 'ajv';
import chai from 'chai';
import config from 'config';
import jsonSourceMap from 'json-source-map';

import fetch from '../../src/fetcher/index.js';
import filter from '../../src/filter/index.js';
import loadServiceDeclarations from '../../src/loader/index.js';
import serviceSchema from './service.schema.js';

const fs = fsApi.promises;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const { expect } = chai;


const serviceDeclarationsPath = path.join(__dirname, '../..', config.get('serviceDeclarationsPath'));
const MIN_DOC_LENGTH = 100;


const args = process.argv.slice(2);
let schemaOnly = false;
if (args.includes('--schema-only')) {
  args.splice(args.indexOf('--schema-only', 1));
  schemaOnly = true;
}

(async () => {
  const serviceDeclarations = await loadServiceDeclarations(serviceDeclarationsPath);

  const servicesToValidate = args.length ? args : Object.keys(serviceDeclarations);

  servicesToValidate.forEach(serviceId => {
    if (!serviceDeclarations.hasOwnProperty(serviceId)) {
      throw new Error(`Could not find any service with id "${serviceId}"`);
    }
  });

  servicesToValidate.forEach(async serviceId => {
    console.log('┣', serviceId);

    let declaration = await fs.readFile(`${serviceDeclarationsPath}/${serviceId}.json`);
    declaration = JSON.parse(declaration);

    console.log('│┣', 'has a valid declaration');
    assertValid(serviceSchema, declaration);

    if (schemaOnly) {
      return;
    }

    const service = serviceDeclarations[serviceId];

    Object.keys(service.documents).forEach(async type => {
      console.log('│┡┓', type);

      const document = service.documents[type];

      console.log('││┣', 'has a URL that can be fetched');
      const { fetch: location } = document;
      const content = await fetch(location);

      console.log('││┣', 'has a selector that matches an element in the web page');
      const filteredContent = await filter(content, document, service.filters);  // TODO: this is not true, the selector might match but the filters remove everything
      expect(filteredContent).to.not.be.empty;

      console.log('││┣', `has a resulting filtered content with at least ${MIN_DOC_LENGTH} characters`);
      expect(filteredContent.length).to.be.greaterThan(MIN_DOC_LENGTH);

      console.log('││┗', 'consistently filters content');
      const secondContent = await fetch(location);
      const secondFilteredContent = await filter(secondContent, document, service.filters);
      expect(secondFilteredContent).to.equal(filteredContent);
    });
  });
})();


const validator = new Ajv({
  allErrors: true,
  jsonPointers: true,
});

function assertValid(schema, subject) {
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
