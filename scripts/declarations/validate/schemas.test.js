import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { expect } from 'chai';

import serviceHistorySchema from './service.history.schema.js';
import serviceSchema from './service.schema.js';

describe('Schema validation', () => {
  let validator;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const fixturesDir = path.join(__dirname, 'fixtures');

  before(() => {
    validator = new Ajv({ allErrors: true });
    addFormats(validator);
  });

  const loadFixture = filePath => {
    const content = fs.readFileSync(filePath, 'utf8');

    return JSON.parse(content);
  };

  const getJsonFiles = dir => {
    const files = fs.readdirSync(dir);

    return files.filter(file => file.endsWith('.json'));
  };

  const validateDeclaration = (schema, declaration, file, shouldBeValid) => {
    const valid = validator.validate(schema, declaration);

    if (!valid && shouldBeValid) {
      console.error(`Validation errors for ${file}:`, validator.errors);
    }

    return valid;
  };

  const createValidationTests = (schema, directory, shouldBeValid) => {
    const files = getJsonFiles(directory);
    const action = shouldBeValid ? 'validates' : 'rejects';

    files.forEach(file => {
      it(`${action} ${file}`, () => {
        const filePath = path.join(directory, file);
        const declaration = loadFixture(filePath);
        const valid = validateDeclaration(schema, declaration, file, shouldBeValid);

        expect(valid, `${file} should be ${shouldBeValid ? 'valid' : 'invalid'}`).to.equal(shouldBeValid);
      });
    });
  };

  describe('Service schema', () => {
    const validDir = path.join(fixturesDir, 'valid');
    const invalidDir = path.join(fixturesDir, 'invalid');

    describe('with valid declarations', () => {
      createValidationTests(serviceSchema, validDir, true);
    });

    describe('with invalid declarations', () => {
      createValidationTests(serviceSchema, invalidDir, false);
    });
  });

  describe('Service history schema', () => {
    const validHistoryDir = path.join(fixturesDir, 'valid-history');
    const invalidHistoryDir = path.join(fixturesDir, 'invalid-history');

    describe('with valid history declarations', () => {
      createValidationTests(serviceHistorySchema, validHistoryDir, true);
    });

    describe('with invalid history declarations', () => {
      createValidationTests(serviceHistorySchema, invalidHistoryDir, false);
    });
  });
});
