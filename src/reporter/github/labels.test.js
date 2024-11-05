import { createRequire } from 'module';

import chai from 'chai';

import { MANAGED_BY_OTA_MARKER } from './index.js';

const require = createRequire(import.meta.url);

const { expect } = chai;
const labels = require('./labels.json');

const GITHUB_LABEL_DESCRIPTION_MAX_LENGTH = 100;

describe('Reporter GitHub labels', () => {
  labels.forEach(label => {
    describe(`"${label.name}"`, () => {
      it('complies with the GitHub character limit for descriptions', () => {
        const descriptionLength = label.description.length + MANAGED_BY_OTA_MARKER.length;

        expect(descriptionLength).to.be.lessThan(GITHUB_LABEL_DESCRIPTION_MAX_LENGTH);
      });

      it('complies with the GitHub constraints for color', () => {
        const validHexColorRegex = /^[0-9a-fA-F]{6}$/; // Regex for a valid 6-digit hexadecimal color code without the `#`

        expect(validHexColorRegex.test(label.color)).to.be.true;
      });
    });
  });
});
