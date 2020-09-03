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
      process.exitCode = 1;
      throw new Error(`Could not find any service with id "${serviceId}"`);
    }
  });

  console.log('Validating', servicesToValidate.length, 'service declarations…');

  const documentsTotals = {
    valid: 0,
    invalid: 0,
  };

  const serviceValidationPromises = servicesToValidate.map(async serviceId => {
    let declaration = await fs.readFile(`${serviceDeclarationsPath}/${serviceId}.json`);
    declaration = JSON.parse(declaration);
    assertValid(serviceSchema, declaration, serviceId);

    if (schemaOnly) {
      return;
    }

    const service = serviceDeclarations[serviceId];

    const documentValidationPromises = Object.keys(service.documents).map(async type => {
      const document = service.documents[type];
      const { fetch: location } = document;

      try {
        const content = await fetch(location);
        const filteredContent = await filter(content, document, service.filters);
        expect(filteredContent.length, 'The textual content after filtering was unexpectedly small.').to.be.greaterThan(MIN_DOC_LENGTH);

        const secondContent = await fetch(location);
        const secondFilteredContent = await filter(secondContent, document, service.filters);
        expect(secondFilteredContent, 'Filters give inconsistent results.').to.equal(filteredContent);
      } catch (failure) {
        failure.source = type;
        documentsTotals.invalid++;
        throw failure;
      }

      documentsTotals.valid++;
      console.log(serviceId, 'has valid', type);
    });

    const documentValidationResults = await Promise.allSettled(documentValidationPromises);

    const failures = documentValidationResults.filter(result => result.status == 'rejected');
    failures.forEach(failure => console.warn(serviceId, 'fails on', failure.reason.source, ':', failure.reason.message));

    if (failures.length) {
      failures.source = serviceId;
      throw failures;
    }
  });

  const serviceValidationResults = await Promise.allSettled(serviceValidationPromises);
  const serviceFailures = serviceValidationResults.filter(result => result.status == 'rejected');

  console.log();
  console.log('Validated', documentsTotals.valid + documentsTotals.invalid, 'documents, out of which', documentsTotals.valid, 'passed and', documentsTotals.invalid, 'failed.');
  console.log(serviceValidationResults.length - serviceFailures.length, 'services are valid.');

  if (serviceFailures.length) {
    console.error(serviceFailures.length, 'services have validation errors. Recap below.\n');
    process.exitCode = 2;

    serviceFailures.forEach(serviceFailure => {
      console.warn(serviceFailure.reason.source);

      if (Array.isArray(serviceFailure.reason)) {
        serviceFailure.reason.forEach(documentFailure => console.warn(' ', documentFailure.reason.source, '\n   ', documentFailure.reason.message));
      } else {
        console.warn('  Service declaration is malformed', serviceFailure.reason.message);
      }
    });
  }
})();


const validator = new Ajv({
  allErrors: true,
  jsonPointers: true,
});

function assertValid(schema, subject, sourceIdentifier) {
  const valid = validator.validate(schema, subject);

  if (!valid) {
    const result = new Error();
    result.source = sourceIdentifier;

    const errorPointers = new Set();
    const sourceMap = jsonSourceMap.stringify(subject, null, 2);
    const jsonLines = sourceMap.json.split('\n');

    validator.errors.forEach(error => {
      result.message += `\n\n${validator.errorsText([error])}`;
      const errorPointer = sourceMap.pointers[error.dataPath];
      if (errorPointer) {
        result.message += `\n> ${jsonLines.slice(errorPointer.value.line, errorPointer.valueEnd.line).join('\n> ')}`;
        errorPointers.add(errorPointer);
      } else {
        result.message += ' (in entire file)\n';
      }
    });

    result.message += `\n\n${errorPointers.size} features have errors in total`;
    throw result;
  }
}
