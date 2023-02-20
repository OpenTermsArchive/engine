# Changelog
All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and the format is based on [Common Changelog](https://common-changelog.org).\
Unlike Common Changelog, the `unreleased` section of [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) is preserved with the addition of a tag to specify which type of release should be published and to foster discussions about it inside pull requests. This tag should be one of the names mandated by SemVer, within brackets: `[patch]`, `[minor]` or `[major]`. For example: `## Unreleased [minor]`.

## Unreleased

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
Full changeset and discussions: [#959](https://github.com/ambanum/OpenTermsArchive/pull/959)._

### Changed
- Improved reliability and expanded coverage of email protection global filter

## 0.19.1 - 2022-12-13
### Fixed
- Add missing configuration for production

## 0.19.0 - 2022-12-13
### Changed
- **Breaking:** Unify all CLI commands as subcommands of one single `ota` command and rename some options; the new CLI can be discovered in the documentation and by running `ota help` ([#978](https://github.com/ambanum/OpenTermsArchive/pull/978))

## 0.18.2 - 2022-12-12
### Fixed
- Ensure paths for given Git storage configuration are relative to current working directory instead of engine module folder

## 0.18.1 - 2022-12-12
### Fixed
- Add missing configuration for production

## 0.18.0 - 2022-12-12
### Added
- Load both the configurations defined in this module and the configurations defined in the module which use it as dependency.

## 0.17.2 - 2022-12-12
### Fixed
- Add missing file required for CLI in the packaging process

## 0.17.1 - 2022-12-06
### Fixed
- Rewrite documentation to bring it up to date with current behaviour.

## 0.17.0 - 2022-12-06
### Added
- Publish package on NPM under name `@opentermsarchive/engine`.
- Export `filter`, `pageDeclaration` and `fetch` in NPM module.
- Add changelog.
