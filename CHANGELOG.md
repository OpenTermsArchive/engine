# Changelog

All changes that impact users of this module are documented in this file, in the [Common Changelog](https://common-changelog.org) format with some additional specifications defined in the CONTRIBUTING file. This codebase adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

## 0.30.0 - 2023-07-10

_Full changeset and discussions: [#1015](https://github.com/OpenTermsArchive/engine/pull/1015)._

### Added

- Embed [Swagger UI](https://swagger.io) for graphical user interface documentation of the API; access it on `/docs`

### Changed

- **Breaking:** Change path from `/services/:serviceId` to `/service/:serviceId` for direct access to a `service` resource; update paths accordingly in your own codebase
- **Breaking:** Change path from `/specs` to `/docs` for OpenAPI specification; update paths accordingly in your own codebase and set the HTTP header `Accept: application/json`

## 0.29.1 - 2023-06-26

_Full changeset and discussions: [#1013](https://github.com/OpenTermsArchive/engine/pull/1013)._

### Fixed

- Fix issue creation on GitHub tracker ([#1012](https://github.com/OpenTermsArchive/engine/issues/1012))

## 0.29.0 - 2023-06-05

_Full changeset and discussions: [#1011](https://github.com/OpenTermsArchive/engine/pull/1011)._

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

### Changed

- Change URL to engine repo from ambanum/OpenTermsArchive to OpenTermsArchive/engine
- Replace documentation with links to the documentation website to avoid redundancy

## 0.26.0 - 2023-02-20

### Changed

- **Breaking:** Split validation and linting of declaration files in 2 commands. `ota validate` does not test the linting of files anymore.
- **Breaking:** `ota lint` does not fix files by default. `ota lint --fix` must be used for that.

## 0.25.2 - 2023-02-20

_Full changeset and discussions: [#981](https://github.com/OpenTermsArchive/engine/pull/981)._

### Added

- Specification of changelog format

### Changed

- Specification of changelog format is now in CONTRIBUTING

## 0.25.1 - 2023-02-20

### Changed

- Improve documentation for CLI commands

## 0.25.0 - 2023-02-08

### Changed

- **Breaking:** Replace behaviour of `ota track --schedule`. It now tracks the changes only on scheduled hours. It was before running also on launch.

## 0.24.0 - 2023-01-25

### Added

- Trigger a release event on CI to deploy documentation website

## 0.23.0 - 2023-01-18

### Removed

- **Breaking:** Remove obsolete ansible deployment recipes as it was extracted in a [dedicated repository](https://github.com/OpenTermsArchive/deployment). Look at the [README](https://github.com/OpenTermsArchive/deployment#readme) to know how to deploy the engine.

## 0.22.0 - 2023-01-17

### Changed

- Replace embedded terms types list with the one defined in the dedicated repository `@opentermsarchive/terms-types`.

## 0.21.0 - 2023-01-16

### Added

- Add dataset command to CLI; this command can be discovered in the documentation and by running `ota dataset help`

## 0.20.0 - 2022-12-13

_Full changeset and discussions: [#959](https://github.com/OpenTermsArchive/engine/pull/959)._

### Changed

- Improved reliability and expanded coverage of email protection global filter

## 0.19.1 - 2022-12-13

### Fixed

- Add missing configuration for production

## 0.19.0 - 2022-12-13

### Changed

- **Breaking:** Unify all CLI commands as subcommands of one single `ota` command and rename some options; the new CLI can be discovered in the documentation and by running `ota help` ([#978](https://github.com/OpenTermsArchive/engine/pull/978))

## 0.18.2 - 2022-12-12

### Fixed

- Ensure paths for given Git storage configuration are relative to current working directory instead of engine module folder

## 0.18.1 - 2022-12-12

_Full changeset and discussions: [#979](https://github.com/OpenTermsArchive/engine/pull/979)._

### Fixed

- Add missing configuration for production

## 0.18.0 - 2022-12-12

_Full changeset and discussions: [#976](https://github.com/OpenTermsArchive/engine/pull/976)._

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

### Added

- Publish package on NPM under name `@opentermsarchive/engine`
- Export `filter`, `pageDeclaration` and `fetch` in NPM module
- Add changelog
