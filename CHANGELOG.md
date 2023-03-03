# Changelog

All changes that impact users of this module are documented in this file, in the [Common Changelog](https://common-changelog.org) format with some additional specifications defined in the CONTRIBUTING file. This codebase adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

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

Full changeset and discussions: [#959](https://github.com/OpenTermsArchive/engine/pull/959)._

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
