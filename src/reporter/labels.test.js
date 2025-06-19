import chai from 'chai';

import GitHub from './github/index.js';
import GitLab from './gitlab/index.js';
import { MANAGED_BY_OTA_MARKER, LABELS } from './labels.js';

const { expect } = chai;

const MAX_LABEL_DESCRIPTION_LENGTH = Math.min(
  GitHub.MAX_LABEL_DESCRIPTION_LENGTH,
  GitLab.MAX_LABEL_DESCRIPTION_LENGTH,
);

describe('Reporter GitHub labels', () => {
  LABELS.forEach(label => {
    describe(`"${label.name}"`, () => {
      it('complies with the max description length of supported platforms', () => {
        const descriptionLength = label.description.length + MANAGED_BY_OTA_MARKER.length;

        expect(descriptionLength).to.be.lessThan(MAX_LABEL_DESCRIPTION_LENGTH);
      });
    });
  });
});
