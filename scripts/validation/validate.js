import fsApi from 'fs';
import path from 'path';

import Ajv from 'ajv';
import chai from 'chai';
import config from 'config';
import jsonSourceMap from 'json-source-map';
import simpleGit from 'simple-git';

import fetch from '../../src/app/fetcher/index.js';
import filter from '../../src/app/filter/index.js';
import loadServiceDeclarations from '../../src/app/loader/index.js';
import serviceSchema from './service.schema.js';

const fs = fsApi.promises;
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const { expect } = chai;
const rootPath = path.join(__dirname, '../..');
const MIN_DOC_LENGTH = 100;
const filePathRelativeToRoot = new URL(import.meta.url).pathname.replace(`${rootPath}/`, '');

const args = process.argv.slice(process.argv.indexOf(filePathRelativeToRoot) + 1); // Keep only args that are after the script filename

const schemaOnly = args.includes('--schema-only');
const modifiedOnly = args.includes('--modified-only');
let servicesToValidate = args.filter(arg => !arg.startsWith('--'));

(async () => {
  const serviceDeclarations = await loadServiceDeclarations(path.join(rootPath, config.get('serviceDeclarationsPath')));

  if (modifiedOnly) {
    servicesToValidate = await getModifiedServices();
  } else if (!servicesToValidate.length) {
    servicesToValidate = Object.keys(serviceDeclarations);
  }

  describe('Services validation', async () => {
    servicesToValidate.forEach(serviceId => {
      const service = serviceDeclarations[serviceId];

      if (!service) {
        process.exitCode = 1;
        throw new Error(`Could not find any service with id "${serviceId}"`);
      }

      describe(serviceId, () => {
        it('has a valid declaration', async () => {
          const declaration = JSON.parse(await fs.readFile(path.join(rootPath, config.get('serviceDeclarationsPath'), `${serviceId}.json`)));
          assertValid(serviceSchema, declaration);
        });

        if (!schemaOnly) {
          Object.keys(service.documents).forEach(type => {
            describe(type, () => {
              let content;
              let filteredContent;
              let mimeType;

              it('has fetchable URL', async function () {
                this.timeout(30000);

                const { fetch: location } = service.documents[type];
                const document = await fetch(location);
                content = document.content;
                mimeType = document.mimeType;
              });

              it('has a selector that matches an element in the web page', async function () {
                if (!content) {
                  console.log('      (Tests skipped as url is not fetchable)');
                  this.skip();
                }

                filteredContent = await filter({
                  content,
                  documentDeclaration: service.documents[type],
                  filterFunctions: service.filters,
                  mimeType,
                });

                expect(filteredContent).to.not.be.empty;
              });

              it(`has a resulting filtered content with at least ${MIN_DOC_LENGTH}`, async function () {
                if (!content) {
                  console.log('      (Tests skipped as url is not fetchable)');
                  this.skip();
                }

                if (!filteredContent) {
                  console.log('      (Tests skipped as content cannot be filtered)');
                  this.skip();
                }

                expect(filteredContent.length).to.be.greaterThan(MIN_DOC_LENGTH);
              });

              context('When fetched and filtered twice in a row', () => {
                it('has consistent filtered content', async function () {
                  if (!content) {
                    console.log('      (Tests skipped as url is not fetchable)');
                    this.skip();
                  }

                  if (!filteredContent) {
                    console.log('      (Tests skipped as content cannot be filtered)');
                    this.skip();
                  }

                  this.timeout(30000);

                  const { fetch: location } = service.documents[type];
                  const document = await fetch(location);

                  const secondFilteredContent = await filter({
                    content: document.content,
                    documentDeclaration: service.documents[type],
                    filterFunctions: service.filters,
                    mimeType: document.mimeType
                  });

                  expect(secondFilteredContent).to.equal(filteredContent);
                });
              });
            });
          });
        }
      });
    });
  });

  run();
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
      errorMessage += `\n\n${validator.errorsText([ error ])}`;
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

async function getModifiedServices() {
  const git = simpleGit(rootPath, { maxConcurrentProcesses: 1 });
  const committedFiles = await git.diff([ '--name-only', 'master...HEAD', '--', 'services/*.json' ]);
  const status = await git.status();
  const modifiedFiles = [
    ...status.not_added, // Files created but not already in staged area
    ...status.modified, // Files modified
    ...status.created, // Files created and in the staged area
    ...status.renamed.map(({ to }) => to), // Files renamed
    ...committedFiles.trim().split('\n') // Files committed
  ];

  return modifiedFiles
    .filter(fileName => fileName.match(/services.*\.json/))
    .map(filePath => path.basename(filePath, '.json'));
}
