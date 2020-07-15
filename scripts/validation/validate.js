import fsApi from 'fs';
import path from 'path';

import Ajv from 'ajv';
import chai from 'chai';
import config from 'config';
import jsdom from 'jsdom';
import jsonSourceMap from 'json-source-map';

import fetch from '../../src/fetcher/index.js';
import filter from '../../src/filter/index.js';
import loadServiceDeclarations from '../../src/loader/index.js';
import serviceSchema from './service.schema.js'
import { TYPES } from '../../src/types.js';

const fs = fsApi.promises;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const expect = chai.expect;
const AVAILABLE_TYPE_NAMES = Object.keys(TYPES);
const rootPath = path.join(__dirname, '../..');

describe('Service validation', () => {
  const serviceId = process.argv.slice(process.argv.indexOf('--serviceId'))[1];
  let service;

  before(async () => {
    const serviceDeclarations = await loadServiceDeclarations(path.join(rootPath, config.get('serviceDeclarationsPath')));
    service = serviceDeclarations[serviceId];

    if (!service) {
      throw new Error(`There is no service declared with the name ${serviceId}`);
    }
  })

  describe(serviceId, () => {
    it('has a valid declaration', async () => {
      const declaration = JSON.parse(await fs.readFile(path.join(rootPath, config.get('serviceDeclarationsPath'), `${serviceId}.json`)));
      assertValid(serviceSchema, declaration);
    });

    AVAILABLE_TYPE_NAMES.forEach(type => {
      describe(TYPES[type].name, function() {
        before(function() {
          if (!service.documents[type]) {
            console.log('      (Tests skipped for this document type as it is not declared for this service)');
            this.skip();
          }
        });

        it('has fetchable URL', async function() {
          this.timeout(10000);

          const { location } = service.documents[type];
          await fetch(location);
        });

        it('has a selector that matches an element in the web page', async function() {
          this.timeout(10000);

          const { contentSelector, location } = service.documents[type];
          let { document: webPageDOM } = new jsdom.JSDOM(await fetch(location)).window;
          const selectedContent = webPageDOM.querySelector(contentSelector);
          expect(selectedContent).to.exist;
        });

        context('When fetched and filtered twice in a row', () => {
          it('has consistent filtered content', async function() {
            this.timeout(10000);

            const { contentSelector, location, filters } = service.documents[type];
            const filteredContent = [];

            for (let i = 0; i < 2; i++) {
              const content = await fetch(location);
              filteredContent[i] = await filter(content, contentSelector, filters, service.filters);
            }

            expect(filteredContent[0]).to.equal(filteredContent[1]);
          });
        });
      });
    });
  });
});


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
      errorMessage += '\n\n' + validator.errorsText([ error ]);
      let errorPointer = sourceMap.pointers[error.dataPath];
      if (errorPointer) {
        errorMessage += '\n> ' + jsonLines.slice(errorPointer.value.line, errorPointer.valueEnd.line).join('\n> ');
        errorPointers.add(errorPointer);
      } else {
        errorMessage += ' (in entire file)\n';
      }
    });

    errorMessage += `\n\n${errorPointers.size} features have errors in total`;

    throw new Error(errorMessage);
  }
}
