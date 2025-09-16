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

  describe('Service schema', () => {
    describe('with valid declarations', () => {
      const validDir = path.join(fixturesDir, 'valid');
      const files = fs.readdirSync(validDir);
      const validFiles = files.filter(file => file.endsWith('.json'));

      validFiles.forEach(file => {
        it(`validates ${file}`, () => {
          const filePath = path.join(validDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const declaration = JSON.parse(content);

          const valid = validator.validate(serviceSchema, declaration);

          if (!valid) {
            console.error(`Validation errors for ${file}:`, validator.errors);
          }

          expect(valid, `${file} should be valid`).to.be.true;
        });
      });
    });

    describe('with invalid declarations', () => {
      const invalidDir = path.join(fixturesDir, 'invalid');
      const files = fs.readdirSync(invalidDir);
      const invalidFiles = files.filter(file => file.endsWith('.json'));

      invalidFiles.forEach(file => {
        it(`rejects ${file}`, () => {
          const filePath = path.join(invalidDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const declaration = JSON.parse(content);

          const valid = validator.validate(serviceSchema, declaration);

          expect(valid, `${file} should be invalid`).to.be.false;
        });
      });
    });
  });

  describe('Service history schema', () => {
    describe('with valid history declarations', () => {
      const validHistoryDir = path.join(fixturesDir, 'valid-history');
      const files = fs.readdirSync(validHistoryDir);
      const validHistoryFiles = files.filter(file => file.endsWith('.json'));

      validHistoryFiles.forEach(file => {
        it(`validates ${file}`, () => {
          const filePath = path.join(validHistoryDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const declaration = JSON.parse(content);

          const valid = validator.validate(serviceHistorySchema, declaration);

          if (!valid) {
            console.error(`Validation errors for ${file}:`, validator.errors);
          }

          expect(valid, `${file} should be valid`).to.be.true;
        });
      });
    });

    describe('with invalid history declarations', () => {
      const invalidHistoryDir = path.join(fixturesDir, 'invalid-history');
      const files = fs.readdirSync(invalidHistoryDir);
      const invalidHistoryFiles = files.filter(file => file.endsWith('.json'));

      invalidHistoryFiles.forEach(file => {
        it(`rejects ${file}`, () => {
          const filePath = path.join(invalidHistoryDir, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const declaration = JSON.parse(content);

          const valid = validator.validate(serviceHistorySchema, declaration);

          expect(valid, `${file} should be invalid`).to.be.false;
        });
      });
    });
  });
});
