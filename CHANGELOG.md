# Changelog

All changes that impact users of this module are documented in this file, in the [Common Changelog](https://common-changelog.org) format with some additional specifications defined in the CONTRIBUTING file. This codebase adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased [minor]

### Added

- Add GtiLab functionalities


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
