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

  console.log('Validating', servicesToValidate.length, 'service declarations…');

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

      const content = await fetch(location);
      const filteredContent = await filter(content, document, service.filters);
      expect(filteredContent.length, `${serviceId} ${type} has an unexpectedly small textual content after filtering`).to.be.greaterThan(MIN_DOC_LENGTH);

      const secondContent = await fetch(location);
      const secondFilteredContent = await filter(secondContent, document, service.filters);
      expect(secondFilteredContent, `${serviceId} ${type} has inconsistent filtered content`).to.equal(filteredContent);
    });

    return Promise.allSettled(documentValidationPromises)
      .then(documentValidationResults => {
        const failures = documentValidationResults.filter(result => result.status == 'rejected');

        failures.forEach(failure => console.warn(serviceId, 'fails:', failure.reason.message));

        if (failures.length) {
          throw failures;
        }

        console.log(serviceId, 'is valid');
      });
  });

  return Promise.allSettled(serviceValidationPromises)
    .then(serviceValidationResults => {
      const totals = {
        rejected: 0,
        fulfilled: 0,
      };

      serviceValidationResults.forEach(result => totals[result.status]++);

      console.log(totals.fulfilled, 'services are valid');
      if (totals.rejected) {
        console.error(totals.rejected, 'services have validation errors');
        process.exitCode = 1;
      }
    });
})();


const validator = new Ajv({
  allErrors: true,
  jsonPointers: true,
});

function assertValid(schema, subject, sourceIdentifier) {
  const valid = validator.validate(schema, subject);

  if (!valid) {
    const errorPointers = new Set();
    let errorMessage = sourceIdentifier ? `In ${sourceIdentifier}:` : '';
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
