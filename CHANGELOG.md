# Changelog

All changes that impact users of this module are documented in this file, in the [Common Changelog](https://common-changelog.org) format with some additional specifications defined in the CONTRIBUTING file. This codebase adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased [major]

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- **Breaking:** Update collection governance roles by adding `contributor`, `analyst` and `diffuser` and replacing `administrator` with `sysadmin`; update roles in your [metadata file](https://docs.opentermsarchive.org/collections/metadata/) at the root of your collection folder

## 8.0.0 - 2025-09-22

_Full changeset and discussions: [#1193](https://github.com/OpenTermsArchive/engine/pull/1193)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- **Breaking:** Update minimum supported Node.js version to v20
- Add `Content Monetisation Policy` terms type, introduced in [`terms-types@2.1.0`](https://github.com/OpenTermsArchive/terms-types/blob/main/CHANGELOG.md#210---2025-02-24)
- Update dependencies

## 7.2.4 - 2025-09-22

_Full changeset and discussions: [#1195](https://github.com/OpenTermsArchive/engine/pull/1195)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix built-in `removeQueryParams` filter to not modify URLs without target parameters

## 7.2.3 - 2025-09-17

_Full changeset and discussions: [#1192](https://github.com/OpenTermsArchive/engine/pull/1192)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix declarations validation when filters history is modified

## 7.2.2 - 2025-09-16

_Full changeset and discussions: [#1191](https://github.com/OpenTermsArchive/engine/pull/1191)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix validation of declaration files with filters

## 7.2.1 - 2025-09-11

_Full changeset and discussions: [#1189](https://github.com/OpenTermsArchive/engine/pull/1189)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Add support for Node.js v24

## 7.2.0 - 2025-09-11

_Full changeset and discussions: [#1178](https://github.com/OpenTermsArchive/engine/pull/1178)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Add support for parameters in filters; see more in the [filters documentation](https://docs.opentermsarchive.org/terms/how-to/apply-filters/)
- Add `removeQueryParams` built-in filter to remove query parameters from links and images; see more in the [built-in filters documentation](https://docs.opentermsarchive.org/terms/reference/built-in-filters/)

## 7.1.0 - 2025-09-10

_Full changeset and discussions: [#1188](https://github.com/OpenTermsArchive/engine/pull/1188)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Improve readability of multi-document terms

## 7.0.0 - 2025-07-21

_Full changeset and discussions: [#1175](https://github.com/OpenTermsArchive/engine/pull/1175)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- **Breaking:** Update issue labels to improve clarity; existing labels will be automatically updated on the first run

## 6.1.0 - 2025-07-21

_Full changeset and discussions: [#1176](https://github.com/OpenTermsArchive/engine/pull/1176)._

> Development of this release was supported by the [Lab Platform Governance, Media and Technology](https://platform-governance.org) (PGMT), Centre for Media, Communication and Information Research (ZeMKI), University of Bremen as part of the project [Governance: Private ordering of ComAI through corporate communication and policies](https://comai.space/en/projects/p4-governance-private-ordering-of-comai-through-corporate-communication-and-policies/) in the research unit [Communicative AI](https://comai.space/en/), funded by the German Research Foundation (DFG) ([Grant No. 516511468)](https://gepris.dfg.de/gepris/projekt/544643936?language=en).

### Changed

- Fetch multiple source documents sequentially to prevent bot detection and improve tracking success rate

## 6.0.1 - 2025-07-07

_Full changeset and discussions: [#1171](https://github.com/OpenTermsArchive/engine/pull/1171)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Ensure labels are properly recreated after removing deprecated labels in GitHub and GitLab reporters

## 6.0.0 - 2025-07-01

_Full changeset and discussions: [#1170](https://github.com/OpenTermsArchive/engine/pull/1170)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- **Breaking:** Replace generic issue labels with more descriptive names to better understand why terms tracking was interrupted; existing labels will be automatically updated on the first run
- Add `⚠ needs intervention` label to highlight critical issues requiring manual action to restore terms tracking

## 5.7.0 - 2025-06-30

_Full changeset and discussions: [#1169](https://github.com/OpenTermsArchive/engine/pull/1169)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Improve headless browser context isolation when fetching pages by disabling cache and clearing cookies between requests to prevent session persistence across different URLs and to improve tracking success rate

## 5.6.1 - 2025-06-30

_Full changeset and discussions: [#1168](https://github.com/OpenTermsArchive/engine/pull/1168)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix automatic labeling of GitHub issues when tracking fails due to DNS resolution errors

## 5.6.0 - 2025-06-19

_Full changeset and discussions: [#1166](https://github.com/OpenTermsArchive/engine/pull/1166)._

> Development of this release was supported by the [Lab Platform Governance, Media and Technology](https://platform-governance.org) (PGMT), Centre for Media, Communication and Information Research (ZeMKI), University of Bremen as part of the project [Governance: Private ordering of ComAI through corporate communication and policies](https://comai.space/en/projects/p4-governance-private-ordering-of-comai-through-corporate-communication-and-policies/) in the research unit [Communicative AI](https://comai.space/en/), funded by the German Research Foundation (DFG) ([Grant No. 516511468)](https://gepris.dfg.de/gepris/projekt/544643936?language=en).

### Added

- Extend automatic retry mechanism for failed tracking attempts due to likely bot blocking errors to improve tracking success rate

## 5.5.0 - 2025-06-04

_Full changeset and discussions: [#1159](https://github.com/OpenTermsArchive/engine/pull/1159)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Add content validation to ensure selectors contain actual text before considering them loaded to improve tracking success rate

## 5.4.2 - 2025-06-02

_Full changeset and discussions: [#1162](https://github.com/OpenTermsArchive/engine/pull/1162)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix engine version in logs, records metadata and collection API

## 5.4.1 - 2025-05-26

_Full changeset and discussions: [#1156](https://github.com/OpenTermsArchive/engine/pull/1156)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix network system error reporting

## 5.4.0 - 2025-05-21

_Full changeset and discussions: [#1155](https://github.com/OpenTermsArchive/engine/pull/1155)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Improve email error and warning reporting to provide more detailed information and better readability

## 5.3.1 - 2025-05-20

_Full changeset and discussions: [#1154](https://github.com/OpenTermsArchive/engine/pull/1154)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Handle connection resets as bot protection to improve tracking success rate

## 5.3.0 - 2025-05-14

_Full changeset and discussions: [#1152](https://github.com/OpenTermsArchive/engine/pull/1152)._

> Development of this release was supported by the [Lab Platform Governance, Media and Technology](https://platform-governance.org) (PGMT), Centre for Media, Communication and Information Research (ZeMKI), University of Bremen as part of the project [Governance: Private ordering of ComAI through corporate communication and policies](https://comai.space/en/projects/p4-governance-private-ordering-of-comai-through-corporate-communication-and-policies/) in the research unit [Communicative AI](https://comai.space/en/), funded by the German Research Foundation (DFG) ([Grant No. 516511468)](https://gepris.dfg.de/gepris/projekt/544643936?language=en).

### Added

- Add an automatic fetching fallback to headless browser when bot detection is encountered to improve tracking success rate

## 5.2.0 - 2025-05-13

_Full changeset and discussions: [#1151](https://github.com/OpenTermsArchive/engine/pull/1151)._

> Development of this release was supported by the [Lab Platform Governance, Media and Technology](https://platform-governance.org) (PGMT), Centre for Media, Communication and Information Research (ZeMKI), University of Bremen as part of the project [Governance: Private ordering of ComAI through corporate communication and policies](https://comai.space/en/projects/p4-governance-private-ordering-of-comai-through-corporate-communication-and-policies/) in the research unit [Communicative AI](https://comai.space/en/), funded by the German Research Foundation (DFG) ([Grant No. 516511468)](https://gepris.dfg.de/gepris/projekt/544643936?language=en).

### Added

- Add an automatic retry mechanism for failed tracking attempts due to likely transient errors to improve tracking success rate

  ⚠️ **Version correction notice**: Version 5.1.1 was incorrectly published as a patch release, violating semantic versioning principles. This version (5.2.0) contains the same changes but is published as a minor version to properly reflect the addition of the new automatic retry mechanism feature.

## 5.1.1 - 2025-05-13

_Full changeset and discussions: [#1150](https://github.com/OpenTermsArchive/engine/pull/1150)._

> Development of this release was supported by the [Lab Platform Governance, Media and Technology](https://platform-governance.org) (PGMT), Centre for Media, Communication and Information Research (ZeMKI), University of Bremen as part of the project [Governance: Private ordering of ComAI through corporate communication and policies](https://comai.space/en/projects/p4-governance-private-ordering-of-comai-through-corporate-communication-and-policies/) in the research unit [Communicative AI](https://comai.space/en/), funded by the German Research Foundation (DFG) ([Grant No. 516511468)](https://gepris.dfg.de/gepris/projekt/544643936?language=en).

### Added

- Add an automatic retry mechanism for failed tracking attempts due to likely transient errors to improve tracking success rate

## 5.1.0 - 2025-05-12

_Full changeset and discussions: [#1149](https://github.com/OpenTermsArchive/engine/pull/1149)._

> Development of this release was supported by the [Lab Platform Governance, Media and Technology](https://platform-governance.org) (PGMT), Centre for Media, Communication and Information Research (ZeMKI), University of Bremen as part of the project [Governance: Private ordering of ComAI through corporate communication and policies](https://comai.space/en/projects/p4-governance-private-ordering-of-comai-through-corporate-communication-and-policies/) in the research unit [Communicative AI](https://comai.space/en/), funded by the German Research Foundation (DFG) ([Grant No. 516511468)](https://gepris.dfg.de/gepris/projekt/544643936?language=en).

### Changed

- Reduce navigation timeout errors and enhance performance of headless browser fetching

## 5.0.6 - 2025-05-09

_Full changeset and discussions: [#1148](https://github.com/OpenTermsArchive/engine/pull/1148)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Update links to documentation in tracking issues reports

## 5.0.5 - 2025-05-07

_Full changeset and discussions: [#1147](https://github.com/OpenTermsArchive/engine/pull/1147)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Enable declarations linting in production environments

## 5.0.4 - 2025-05-06

_Full changeset and discussions: [#1146](https://github.com/OpenTermsArchive/engine/pull/1146)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix creation of issues labels for GitHub repositories with over 30 labels

## 5.0.3 - 2025-03-10

_Full changeset and discussions: [#1141](https://github.com/OpenTermsArchive/engine/pull/1141)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix MongoDB repository support of terms with multiple source documents

## 5.0.2 - 2025-03-05

_Full changeset and discussions: [#1140](https://github.com/OpenTermsArchive/engine/pull/1140)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix validation of the collection metadata file

## 5.0.1 - 2025-03-04

_Full changeset and discussions: [#1139](https://github.com/OpenTermsArchive/engine/pull/1139)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Validate required fields in collection metadata file

## 5.0.0 - 2025-02-18

_Full changeset and discussions: [#1137](https://github.com/OpenTermsArchive/engine/pull/1137)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- **Breaking:** Rename `documents` key to `terms` in service declarations for vocabulary consistency; to update your declarations:

  For Unix-like systems:

  ```bash
  find . -name "*.json" -type f -exec sed -i 's/"documents":/"terms":/g' {} +
  ```

  For macOS:

  ```bash
  find . -name "*.json" -type f -exec sed -i '' 's/"documents":/"terms":/g' {} +
  ```

  ⚠️ Note: when updating the engine, CI checks of modified declarations will fail once. This is expected and can be safely ignored

## 4.2.0 - 2025-02-17

_Full changeset and discussions: [#1135](https://github.com/OpenTermsArchive/engine/pull/1135)._

> Development of this release was supported by the [European Union](https://commission.europa.eu/).

### Added

- Add support for nested subgroups in Gitlab reporter repository paths

### Fixed

- Fix error logging in Gitlab reporter

## 4.1.0 - 2025-02-17

_Full changeset and discussions: [#1134](https://github.com/OpenTermsArchive/engine/pull/1134)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Add `ota validate metadata` command to the CLI to validate the collection metadata file

## 4.0.2 - 2025-02-04

_Full changeset and discussions: [#1133](https://github.com/OpenTermsArchive/engine/pull/1133)._

> Development of this release was supported by the [European Union](https://commission.europa.eu/).

### Fixed

- Fix functionality of filtering by status for the issues list on GitLab

## 4.0.1 - 2024-12-11

_Full changeset and discussions: [#1124](https://github.com/OpenTermsArchive/engine/pull/1124)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix documentation of collection metadata in the collection API

## 4.0.0 - 2024-12-04

_Full changeset and discussions: [#1123](https://github.com/OpenTermsArchive/engine/pull/1123)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- **Breaking:** Expose collection metadata through the collection API; ensure to add the required [metadata file](https://docs.opentermsarchive.org/collections/metadata/) at the root of your collection folder

### Changed

- **Breaking:** Replace `@opentermsarchive/engine.services.declarationsPath` with `@opentermsarchive/engine.collectionPath`; ensure your declarations are located in `./declarations` in your collection folder

## 3.0.0 - 2024-12-03

_Full changeset and discussions: [#1122](https://github.com/OpenTermsArchive/engine/pull/1122)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- **Breaking:** Updated peer dependency `@opentermsarchive/terms-types` to `v2.0.0`; in your declarations, if you define a specific version of this library, ensure to also upgrade it to `v2.0.0` to avoid compatibility issues; see [terms-types@2.0.0](https://github.com/OpenTermsArchive/terms-types/blob/main/CHANGELOG.md#200---2024-12-02) for details

## 2.7.2 - 2024-11-27

_Full changeset and discussions: [#1121](https://github.com/OpenTermsArchive/engine/pull/1121)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Optimize performance for Git storage

## 2.7.1 - 2024-11-21

_Full changeset and discussions: [#1120](https://github.com/OpenTermsArchive/engine/pull/1120)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix timestamp prefix format in logs

## 2.7.0 - 2024-11-20

_Full changeset and discussions: [#1118](https://github.com/OpenTermsArchive/engine/pull/1118)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Add configuration option to toggle timestamp prefix in logs; set [`@opentermsarchive/engine.logger.timestampPrefix` to `true` or `false` in your configuration file](https://docs.opentermsarchive.org/#configuring) to control this feature.

## 2.6.0 - 2024-11-19

_Full changeset and discussions: [#1116](https://github.com/OpenTermsArchive/engine/pull/1116)._

> Development of this release was supported by the [European Union](https://commission.europa.eu/) and the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Add support for GitLab for issue reporting
- Add support for GitLab Releases for publishing datasets

## 2.5.0 - 2024-10-29

_Full changeset and discussions: [#1115](https://github.com/OpenTermsArchive/engine/pull/1115)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Add script to remove duplicate issues in GitHub reports

## 2.4.0 - 2024-10-24

_Full changeset and discussions: [#1114](https://github.com/OpenTermsArchive/engine/pull/1114)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Add `Service Level Agreement` terms type, introduced in [`terms-types@1.4.0`](https://github.com/OpenTermsArchive/terms-types/blob/main/CHANGELOG.md#140---2024-10-24)

## 2.3.3 - 2024-10-23

_Full changeset and discussions: [#1113](https://github.com/OpenTermsArchive/engine/pull/1113)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Reduce GitHub API calls in issues reporter

## 2.3.2 - 2024-10-23

_Full changeset and discussions: [#1112](https://github.com/OpenTermsArchive/engine/pull/1112)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Reduce API calls and avoid inconsistent states on GitHub issues reports

## 2.3.1 - 2024-10-22

_Full changeset and discussions: [#1111](https://github.com/OpenTermsArchive/engine/pull/1111)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Prevent duplicate issues on GitHub reports

## 2.3.0 - 2024-10-21

_Full changeset and discussions: [#1110](https://github.com/OpenTermsArchive/engine/pull/1110)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Bump `@opentermsarchive/terms-types` peer dependency to support new types introduced in [v1.3.0](https://github.com/OpenTermsArchive/terms-types/blob/main/CHANGELOG.md#130---2024-08-12)

## 2.2.2 - 2024-10-21

_Full changeset and discussions: [#1109](https://github.com/OpenTermsArchive/engine/pull/1109)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Prevent the engine from exiting on SMTP errors from the logger

## 2.2.1 - 2024-06-07

_Full changeset and discussions: [#1088](https://github.com/OpenTermsArchive/engine/pull/1088)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Display engine version in logs

### Fixed

- Fix the number of terms displayed in logs
- Fix Reporter module instantiation

## 2.2.0 - 2024-06-05

_Full changeset and discussions: [#1087](https://github.com/OpenTermsArchive/engine/pull/1087)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Set default tracking frequency to two per day

## 2.1.0 - 2024-06-04

_Full changeset and discussions: [#1086](https://github.com/OpenTermsArchive/engine/pull/1086)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Make tracking schedule configurable
- Make publishing schedule configurable
- Add tracking overrun protection

## 2.0.1 - 2024-05-31

_Full changeset and discussions: [#1085](https://github.com/OpenTermsArchive/engine/pull/1085)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Corrected a missing negation in a Reporter error log

## 2.0.0 - 2024-05-22

_Full changeset and discussions: [#1071](https://github.com/OpenTermsArchive/engine/pull/1071)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- **Breaking:** Nest all configurations under the `@opentermsarchive/engine` key; wrap the content of `config/production.json` like this: `{ @opentermsarchive/engine: { < your previous configuration >}}`
- **Breaking:** Rename the `api` configuration key to `collection-api`; update this in your `config/production.json`
- **Breaking:** Remove default values for `port` and `basePath` in `collection-api`; specify these configurations explicitly in your `config/production.json`
- **Breaking:** Prefix all environment variables with `OTA_ENGINE_`; rename variables such as `SENDINBLUE_API_KEY` to `OTA_ENGINE_SENDINBLUE_API_KEY`, `SMTP_PASSWORD` to `OTA_ENGINE_SMTP_PASSWORD`, and `GITHUB_TOKEN` to `OTA_ENGINE_GITHUB_TOKEN`

## 1.3.0 - 2024-05-22

_Full changeset and discussions: [#1076](https://github.com/OpenTermsArchive/engine/pull/1076)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Enable a service to be renamed into several services when exporting a dataset

## 1.2.2 - 2024-05-22

_Full changeset and discussions: [#1075](https://github.com/OpenTermsArchive/engine/pull/1075)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Exclude non-record files (e.g., README, LICENSE) from dataset

## 1.2.1 - 2024-05-09

_Full changeset and discussions: [#1070](https://github.com/OpenTermsArchive/engine/pull/1070)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix `ota lint` command

## 1.2.0 - 2024-05-08

_Full changeset and discussions: [#1069](https://github.com/OpenTermsArchive/engine/pull/1069)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Add label `empty content` to reported issues on GitHub when server returns empty content or when PDF content is unextractable
- Add label `invalid selector` to reported issues on GitHub when CSS selector is invalid

### Changed

- Consider extraction errors as expected operational errors instead of crashing the engine

### Fixed

- Do not crash when source documents links point to invalid URLs
- Take into account the `--types` CLI option
- Fix counts of terms when they are specified via the CLI option `--types`
- Fix display issues for service ID and terms type associated with errors

## 1.1.3 - 2024-05-02

_Full changeset and discussions: [#1068](https://github.com/OpenTermsArchive/engine/pull/1068)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix validation of modified declarations when declaration history is modified; bug introduced in v1.1.2

## 1.1.2 - 2024-04-08

_Full changeset and discussions: [#1066](https://github.com/OpenTermsArchive/engine/pull/1066)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix validation of modified declarations when new services were added
- Fix validation of modified declarations when filters were modified

## 1.1.1 - 2024-03-28

_Full changeset and discussions: [#1065](https://github.com/OpenTermsArchive/engine/pull/1065)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Ensure to reopen associated issue if terms become inaccessible again

## 1.1.0 - 2024-03-18

_Full changeset and discussions: [#1063](https://github.com/OpenTermsArchive/engine/pull/1063)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Introduce `pluginError` error type to isolate plugin errors from the engine and increase robustness

## 1.0.0 - 2024-03-14

_Full changeset and discussions: [#1061](https://github.com/OpenTermsArchive/engine/pull/1061)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

_No code changes were made in this release, it simply signifies that the public API can now [be considered stable](https://semver.org/spec/v2.0.0.html#spec-item-5)._

## 0.37.1 - 2024-02-20

_Full changeset and discussions: [#1056](https://github.com/OpenTermsArchive/engine/pull/1056)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix support of service names with special character in the validation CLI

## 0.37.0 - 2024-02-20

_Full changeset and discussions: [#1054](https://github.com/OpenTermsArchive/engine/pull/1054)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Minimize required privileges associated to the GitHub token to create issues in the declarations repository

## 0.36.1 - 2024-02-15

_Full changeset and discussions: [#1053](https://github.com/OpenTermsArchive/engine/pull/1053)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Log a warning in case log emails cannot be sent because of a missing config

## 0.36.0 - 2024-02-15

_Full changeset and discussions: [#1052](https://github.com/OpenTermsArchive/engine/pull/1052)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- **Breaking:** Base the loading of the Notifier module on the presence of required configuration, not on the environment; only define the `SENDINBLUE_API_KEY` environment variable if you want the Notifier to be loaded, avoid relying on `NODE_ENV=production`

## 0.35.0 - 2024-02-14

_Full changeset and discussions: [#1051](https://github.com/OpenTermsArchive/engine/pull/1051)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Consider EAI_AGAIN errors as a legitimate part of the tracking lifecycle rather than causing the engine to crash

## 0.34.3 - 2024-02-13

_Full changeset and discussions: [#1050](https://github.com/OpenTermsArchive/engine/pull/1050)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix engine hang with non-existent service ID

## 0.34.2 - 2024-02-12

_Full changeset and discussions: [#1045](https://github.com/OpenTermsArchive/engine/pull/1045)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix support of special character in service names

## 0.34.1 - 2023-12-19

_Full changeset and discussions: [#1037](https://github.com/OpenTermsArchive/engine/pull/1037)._

> Development of this release was made on a volunteer basis by [@Ndpnt](http://github.com/ndpnt).

### Fixed

- Improve performance for large-scale MongoDB databases

## 0.34.0 - 2023-12-11

_Full changeset and discussions: [#1033](https://github.com/OpenTermsArchive/engine/pull/1033)._

> Development of this release was [supported](https://nlnet.nl/project/TOSDR-OTA/) by the [NGI0 Entrust Fund](https://nlnet.nl/entrust), a fund established by [NLnet](https://nlnet.nl/) with financial support from the European Commission's [Next Generation Internet](https://www.ngi.eu) programme, under the aegis of DG CNECT under grant agreement N°101069594.

### Added

- Expose versions data through the collection API ([#1003](https://github.com/OpenTermsArchive/engine/pull/1028)). When using Git as storage for versions, this API relies on the assumption that the commit date matches the author date, introduced in the engine in June 2022 ([#875](https://github.com/OpenTermsArchive/engine/pull/875)). If your collection was created before this date, inconsistencies in the API results may arise. You can verify if your version history includes commits with commit dates differing from author dates by executing the following command at the root of your versions repository: `git log --format="%H %ad %cI" --date=iso-strict | awk '{if ($2 != $3) print "Author date", $2, "and commit date", $3, "mismatch for commit", $1 }'`. You can correct the history with the command: `git rebase --committer-date-is-author-date $(git rev-list --max-parents=0 HEAD)`. Since the entire history will be rewritten, a force push may be required for distributed repositories

### Changed

- Provide a succinct JSON-formatted error message as response in API errors

## 0.33.1 - 2023-11-28

_Full changeset and discussions: [#1032](https://github.com/OpenTermsArchive/engine/pull/1032)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Update ESLint to use the [stylistic](https://eslint.style/packages/js) plugin following [deprecation of formatting rules](https://eslint.org/blog/2023/10/deprecating-formatting-rules/), correcting a randomly-appearing `Configuration for rule "lines-between-class-members" is invalid` error

## 0.33.0 - 2023-11-27

_Full changeset and discussions: [#1031](https://github.com/OpenTermsArchive/engine/pull/1031)._

> Development of this release was [supported](https://nlnet.nl/project/TOSDR-OTA/) by the [NGI0 Entrust Fund](https://nlnet.nl/entrust), a fund established by [NLnet](https://nlnet.nl/) with financial support from the European Commission's [Next Generation Internet](https://www.ngi.eu) programme, under the aegis of DG CNECT under grant agreement N°101069594.

### Added

- Add `terms` attribute to `/services` API response, containing declared term types for each service

## 0.32.1 - 2023-10-18

_Full changeset and discussions: [#1026](https://github.com/OpenTermsArchive/engine/pull/1026)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Ensure `Reporter` configuration is defined before instantiating it
- Ensure to add links to `versions` and `snapshots` in issues only if repositories are defined in configuration

### Removed

- No longer define default configuration for `Reporter` module

## 0.32.0 - 2023-10-18

_Full changeset and discussions: [#1025](https://github.com/OpenTermsArchive/engine/pull/1025)._

> Development of this release was supported by [GitHub Social Impact](https://socialimpact.github.com/) through its [DPG Open Source Community Manager Program](https://socialimpact.github.com/tech-for-social-good/dpg-open-source-community-manager-program).

### Added

- Auto create labels for declarations repository on GitHub
- Assign a label based on the error type to issues managed by the engine

### Changed

- **Breaking:** Revise the formatting of reported issues, with notable adjustments to the title, transitioning from `Fix <service_id> - <terms_type>` to `<service_id> ‧ <terms_type> ‧ not tracked anymore`
- **Breaking:** Rename `tracker` module into `reporter`; update your configuration file by renaming `tracker` into `reporter`
- **Breaking:** Change configuration for `reporter` module; update your `reporter` [configuration accordingly](https://docs.opentermsarchive.org/#configuring)

### Removed

- **Breaking:** No longer assign the label `bot-report` to issues managed by the engine

## 0.31.1 - 2023-10-06

_Full changeset and discussions: [#1024](https://github.com/OpenTermsArchive/engine/pull/1024)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Upgrade dependencies patches and ensure compatibility with Node v20

## 0.31.0 - 2023-09-08

_Full changeset and discussions: [#1021](https://github.com/OpenTermsArchive/engine/pull/1021)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- **Breaking:** Update `opentermsarchive/terms-types` dependency; update your declarations [following the instructions in the changelog](https://github.com/OpenTermsArchive/terms-types/blob/main/CHANGELOG.md#100---2023-09-08) for validating declarations

## 0.30.1 - 2023-09-06

_Full changeset and discussions: [#1020](https://github.com/OpenTermsArchive/engine/pull/1020)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix validation for removed terms types

## 0.30.0 - 2023-07-10

_Full changeset and discussions: [#1015](https://github.com/OpenTermsArchive/engine/pull/1015)._

> Development of this release was [supported](https://nlnet.nl/project/TOSDR-OTA/) by the [NGI0 Entrust Fund](https://nlnet.nl/entrust), a fund established by [NLnet](https://nlnet.nl/) with financial support from the European Commission's [Next Generation Internet](https://www.ngi.eu) programme, under the aegis of DG CNECT under grant agreement N°101069594.

### Added

- Embed [Swagger UI](https://swagger.io) for graphical user interface documentation of the API; access it on `/docs`

### Changed

- **Breaking:** Change path from `/services/:serviceId` to `/service/:serviceId` for direct access to a `service` resource; update paths accordingly in your own codebase
- **Breaking:** Change path from `/specs` to `/docs` for OpenAPI specification; update paths accordingly in your own codebase and set the HTTP header `Accept: application/json`

## 0.29.1 - 2023-06-26

_Full changeset and discussions: [#1013](https://github.com/OpenTermsArchive/engine/pull/1013)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Fix issue creation on GitHub tracker ([#1012](https://github.com/OpenTermsArchive/engine/issues/1012))

## 0.29.0 - 2023-06-05

_Full changeset and discussions: [#1011](https://github.com/OpenTermsArchive/engine/pull/1011)._

> Development of this release was [supported](https://nlnet.nl/project/TOSDR-OTA/) by the [NGI0 Entrust Fund](https://nlnet.nl/entrust), a fund established by [NLnet](https://nlnet.nl/) with financial support from the European Commission's [Next Generation Internet](https://www.ngi.eu) programme, under the aegis of DG CNECT under grant agreement N°101069594.

### Added

- Add collection metadata API ([#1003](https://github.com/OpenTermsArchive/engine/issues/1003))
- Add `ota serve` command to CLI to start the server and expose the API

## 0.28.0 - 2023-04-25

### Changed

- Include collection name in dataset name

## 0.27.1 - 2023-04-19

### Changed

- Clean up README

## 0.27.0 - 2023-04-19

_Full changeset and discussions: [#996](https://github.com/OpenTermsArchive/engine/pull/996), [#999](https://github.com/OpenTermsArchive/engine/pull/999), [#1000](https://github.com/OpenTermsArchive/engine/pull/1000)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- **Breaking:** Rename CLI option `--terms-types` to `--types` in API; simply rename accordingly in your own codebase
- **Breaking:** Rename CLI option `--refilter-only`, `-r` to `--extract-only`, `-e` in API; simply rename accordingly in your own codebase
- **Breaking:** Rename class `PageDeclaration` to `SourceDocument` and its atribute `noiseSelectors` to `insignificantContentSelectors` in API; simply rename accordingly in your own codebase
- **Breaking:** Rename function and its parameters `filter({ content, mimeType, pageDeclaration })` to `extract(sourceDocument)` in API; `content` and `mimeType` are embedded `sourceDocument` attributes; rename accordingly in your own codebase and set `content` and `mimeType` in the `sourceDocument` passed as a parameter to the function
- **Breaking:** Rephrase commit messages in Git storage: `Start tracking` is changed to `First record of`, `Refilter` to `Apply technical or declaration upgrade on` and `Update` to `Record new changes of`; existing data will still be loaded, but new commits will use these new messages, if you have scripts that parse commit messages directly, update them accordingly
- **Breaking:** Rename document attribute `isRefilter` to `isExtractOnly` in MongoDB storage; existing data will still be loaded, but new entries will use this new attribute, if you have scripts that query the Mongo database directly, update them accordingly
- Make vocabulary consistent throughout the codebase ([#971](https://github.com/OpenTermsArchive/engine/pull/971))

### Removed

- **Breaking:** Remove `npm run extract` command; use `npm run start -- --extract-only` instead

## 0.26.1 - 2023-04-19

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Change URL to engine repo from `ambanum/OpenTermsArchive` to `OpenTermsArchive/engine`
- Replace documentation with links to the documentation website to avoid redundancy

## 0.26.0 - 2023-02-20

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- **Breaking:** Split validation and linting of declaration files in 2 commands. `ota validate` does not test the linting of files anymore.
- **Breaking:** `ota lint` does not fix files by default. `ota lint --fix` must be used for that.

## 0.25.2 - 2023-02-20

_Full changeset and discussions: [#981](https://github.com/OpenTermsArchive/engine/pull/981)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Specification of changelog format

### Changed

- Specification of changelog format is now in CONTRIBUTING

## 0.25.1 - 2023-02-20

### Changed

- Improve documentation for CLI commands

## 0.25.0 - 2023-02-08

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- **Breaking:** Replace behaviour of `ota track --schedule`. It now tracks the changes only on scheduled hours. It was before running also on launch.

## 0.24.0 - 2023-01-25

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Trigger a release event on CI to deploy documentation website

## 0.23.0 - 2023-01-18

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Removed

- **Breaking:** Remove obsolete ansible deployment recipes as it was extracted in a [dedicated repository](https://github.com/OpenTermsArchive/deployment). Look at the [README](https://github.com/OpenTermsArchive/deployment#readme) to know how to deploy the engine.

## 0.22.0 - 2023-01-17

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Replace embedded terms types list with the one defined in the dedicated repository `@opentermsarchive/terms-types`.

## 0.21.0 - 2023-01-16

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Add dataset command to CLI; this command can be discovered in the documentation and by running `ota dataset help`

## 0.20.0 - 2022-12-13

_Full changeset and discussions: [#959](https://github.com/OpenTermsArchive/engine/pull/959)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- Improved reliability and expanded coverage of email protection global filter

## 0.19.1 - 2022-12-13

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Add missing configuration for production

## 0.19.0 - 2022-12-13

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Changed

- **Breaking:** Unify all CLI commands as subcommands of one single `ota` command and rename some options; the new CLI can be discovered in the documentation and by running `ota help` ([#978](https://github.com/OpenTermsArchive/engine/pull/978))

## 0.18.2 - 2022-12-12

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Fixed

- Ensure paths for given Git storage configuration are relative to current working directory instead of engine module folder

## 0.18.1 - 2022-12-12

_Full changeset and discussions: [#979](https://github.com/OpenTermsArchive/engine/pull/979)._

### Fixed

- Add missing configuration for production

## 0.18.0 - 2022-12-12

_Full changeset and discussions: [#976](https://github.com/OpenTermsArchive/engine/pull/976)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Load both the configurations defined in this module and the configurations defined in the module which use it as dependency

## 0.17.2 - 2022-12-12

_Full changeset and discussions: [#977](https://github.com/OpenTermsArchive/engine/pull/977)._

### Fixed

- Add missing file required for CLI in the packaging process

## 0.17.1 - 2022-12-06

_Full changeset and discussions: [#971](https://github.com/OpenTermsArchive/engine/pull/971)._

### Fixed

- Rewrite documentation to bring it up to date with current behaviour

## 0.17.0 - 2022-12-06

_Full changeset and discussions: [#957](https://github.com/OpenTermsArchive/engine/pull/957)._

> Development of this release was supported by the [French Ministry for Foreign Affairs](https://www.diplomatie.gouv.fr/fr/politique-etrangere-de-la-france/diplomatie-numerique/) through its ministerial [State Startups incubator](https://beta.gouv.fr/startups/open-terms-archive.html) under the aegis of the Ambassador for Digital Affairs.

### Added

- Publish package on NPM under name `@opentermsarchive/engine`
- Export `filter`, `pageDeclaration` and `fetch` in NPM module
- Add changelog
