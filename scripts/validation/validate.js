import fsApi from 'fs';
import path from 'path';

import config from 'config';
import chai from 'chai';
import Ajv from 'ajv';
import jsonSourceMap from 'json-source-map';
import jsdom from 'jsdom';

import fetch from '../../src/fetcher/index.js';
import filter from '../../src/filter/index.js';
import loadServiceDeclarations from '../../src/loader/index.js';
import serviceSchema from './service.schema.js'
import { TYPES } from '../../src/types.js';
const AVAILABLE_TYPE_NAMES = Object.keys(TYPES);

const fs = fsApi.promises;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const expect = chai.expect;

const rootPath = path.join(__dirname, '../..');

describe('Service validations', () => {
  const serviceId = process.argv.slice(process.argv.indexOf('--serviceId'))[1];
  let service;

  before(async () => {
    const serviceDeclarations = await loadServiceDeclarations(path.join(rootPath, config.get('serviceDeclarationsPath')));
    service = serviceDeclarations[serviceId];

    if (!service) {
      throw new Error(`There are no service declared with the name ${serviceId}`);
    }
  })

  describe(serviceId, () => {
    it('has a valid declaration', async () => {
      const file = JSON.parse(await fs.readFile(path.join(rootPath, config.get('serviceDeclarationsPath'), `${serviceId}.json`)));
      const validator = new Ajv({
        allErrors: true,
        jsonPointers: true,
      });
      const valid = validator.validate(serviceSchema, file);
      if (!valid) {
        let errorMessage = '';
        const sourceMap = jsonSourceMap.stringify(file, null, 2);
        const jsonLines = sourceMap.json.split('\n');
        validator.errors.forEach(error => {
          errorMessage += '\n\n' + validator.errorsText([error]);
          let errorPointer = sourceMap.pointers[error.dataPath];
          if (errorPointer) {
            errorMessage += '\n> ' + jsonLines.slice(errorPointer.value.line, errorPointer.valueEnd.line).join('\n> ');
          } else {
            errorMessage += ' (in entire file)\n';
          }
        });
        throw new Error(errorMessage);
      }
    });

    AVAILABLE_TYPE_NAMES.forEach(type => {
      describe(TYPES[type].name, function() {
        before(function() {
          if (!service.documents[type]) {
            console.log('Tests skipped for this document type as it is not declared for this service.');
            this.skip();
          }
        });

        it('has fetchable URL', async function() {
          this.timeout(10000);

          const { location } = service.documents[type];
          await fetch(location);
        });

        it('has a selector which match an element in the web page', async function() {
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

            expect(filteredContent[0]).to.be.equal(filteredContent[1]);
          });
        });
      });
    });
  });
});
