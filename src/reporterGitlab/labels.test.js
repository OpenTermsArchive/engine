// Copyright (c) 2024 European Union
// *
// Licensed under the EUPL, Version 1.2 or – as soon they will be approved by the
// European Commission – subsequent versions of the EUPL (the “Licence”);
// You may not use this work except in compliance with the Licence.
// You may obtain a copy of the Licence at:
// *
// https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
// *
// Unless required by applicable law or agreed to in writing, software distributed under
// the Licence is distributed on an “AS IS” basis, WITHOUT WARRANTIES OR CONDITIONS
// OF ANY KIND, either express or implied. See the Licence for the specific language
// governing permissions and limitations under the Licence.
//
// EUPL text (EUPL-1.2)

import { createRequire } from 'module';

import chai from 'chai';

import { MANAGED_BY_OTA_MARKER } from './gitlab.js';

const require = createRequire(import.meta.url);

const { expect } = chai;
const labels = require('./labels.json');

const GITLAB_LABEL_DESCRIPTION_MAX_LENGTH = 255;

describe('Reporter GitLab labels', () => {
  labels.forEach(label => {
    describe(`"${label.name}"`, () => {
      it('complies with the GitLab character limit for descriptions', () => {
        const descriptionLength = label.description.length + MANAGED_BY_OTA_MARKER.length;

        expect(descriptionLength).to.be.lessThan(GITLAB_LABEL_DESCRIPTION_MAX_LENGTH);
      });

      it('complies with the GitLab constraints for color', () => {
        const validHexColorRegex = /^#[0-9a-fA-F]{6}$/; // Regex for a valid 6-digit hexadecimal color code with the `#`

        expect(validHexColorRegex.test(label.color)).to.be.true;
      });
    });
  });
});
