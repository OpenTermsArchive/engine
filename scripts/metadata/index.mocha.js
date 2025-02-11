import fs from 'fs/promises';
import path from 'path';

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import config from 'config';
import Croner from 'croner';
import yaml from 'js-yaml';

import specsRouter from '../../src/collection-api/routes/docs.js';

describe('Metadata file validation', () => {
  const formatValidators = {
    'iso639-1': code => /^[a-z]{2}$/.test(code),
    'iso3166-2': code => /^[A-Z]{2}(-[A-Z0-9]{1,3})?$/.test(code),
    'cron-expression': cronExpression => {
      try {
        Croner(cronExpression); // eslint-disable-line new-cap

        return true;
      } catch {
        return false;
      }
    },
  };

  const formatMessages = {
    'iso639-1': 'must be a valid ISO 639-1 language code (two lowercase letters, e.g., "en", "fr")',
    'iso3166-2': 'must be a valid ISO 3166-2 region code (two uppercase letters, e.g., "FR", "US")',
    'cron-expression': 'must be a valid cron expression (see https://en.wikipedia.org/wiki/Cron#Cron_expression)',
  };

  let metadata;
  let validate;

  before(async () => {
    const { specs } = specsRouter(''); // Extract Metadata OpenAPI specification from JSDoc comments in the collection API router to validate the metadata schema. Can be achieved until API specification and Metadata file schema diverge
    const metadataSchema = specs.components.schemas.Metadata;
    const collectionPath = path.resolve(process.cwd(), config.get('@opentermsarchive/engine.collectionPath'));
    const metadataContent = await fs.readFile(path.join(collectionPath, 'metadata.yml'), 'utf8');

    metadata = yaml.load(metadataContent, { schema: yaml.CORE_SCHEMA }); // Use CORE_SCHEMA to parse dates as strings rather than JavaScript Date objects

    const ajv = new Ajv({ allErrors: true });

    addFormats(ajv);

    Object.entries(formatValidators).forEach(([ format, validator ]) => {
      ajv.addFormat(format, { type: 'string', validate: validator });
    });

    validate = ajv.compile(metadataSchema);
    validate(metadata);
  });

  it('is valid', () => {
    if (!validate.errors) {
      return;
    }

    const errors = validate.errors.map(error => {
      const instancePath = error.instancePath.split('/').slice(1);
      const actualValue = instancePath.reduce((obj, key) => obj?.[key], metadata);
      const basePath = error.instancePath || '/root';

      if (error.keyword === 'additionalProperties') {
        return `- ${basePath}: Found unexpected property "${error.params.additionalProperty}"`;
      }

      if (error.keyword === 'format' && formatMessages[error.params.format]) {
        return `- ${basePath}: "${actualValue}" ${formatMessages[error.params.format]}`;
      }

      let message = `- ${basePath}: "${actualValue}" ${error.message}`;

      if (error.keyword === 'enum') {
        message += ` "${error.params.allowedValues.join('", "')}"`;
      }

      return message;
    });

    throw new Error(`\n${errors.join('\n')}`);
  });
});
