# Choosing service name and service ID

- Date: 2020-10-14

## Context and Problem Statement

To scale up from 50 to 5,000 services, we need a clear way for choosing the service name and the service ID.

### We need

A name that reflects the common name used by the provider itself, to be exposed in a GUI. This name is currently exposed as the name property in the service declaration.
An ID of sorts that can be represented in the filesystem. This ID is currently exposed as the filename of the service declaration, without the .json extension.

### Use cases

The service name is presented to end users. It should reflect as closely as possible the official service name, so that it can be identified easily.
The ID is used internally and exposed for analysis. It should be easy to handle with scripts and other tools.

### Constraints for the ID

As long as this ID is stored in the filesystem:

- No `/` for UNIX.
- No `\` for Windows.
- No `:` for APFS and HFS.
- No case-sensitive duplicates to support case-insensitive filesystems.
- No more than 255 characters to support transfer over [FAT32](https://en.wikipedia.org/wiki/File_Allocation_Table#FAT32).

UTF, spaces and capitals are all supported, even on case-insensitive filesystems.

### However

- UTF in filenames can be [a (fixable) problem with Git and HFS+](https://stackoverflow.com/questions/5581857/git-and-the-umlaut-problem-on-mac-os-x).
- UTF in filenames is by default quoted in Git, leading for example `été.txt` to be displayed as `"\303\251t\303\251.txt"`.
- Most online services align their brand name with their domain name. Even though UTF is now officially supported in domain names, support is limited and most services, even non-Western, have an official ASCII transliteration used at least in their domain name (e.g. “qq” by Tencent, “rzd.ru” for “РЖД”, “yahoo” for “Yahoo!”).
- We currently use GitHub as a GUI, so the service ID is presented to the user instead of the service name. The name is used in email notifications.

## Decision Outcome

1. The service name should be the one used by the service itself, no matter the alphabet.

- _Example: `туту.ру`_.

2. We don't support non-ASCII characters in service IDs, at least as long as the database is Git and the filesystem, in order to minimise risk. Service IDs are derived from the service name through normalization into ASCII.

- _Example: `туту.ру` → `tutu.ru`_.
- _Example: `historielærer.dk` → `historielaerer.dk`_.
- _Example: `RTÉ` → `RTE`_.

3. We support punctuation, except characters that have meaning at filesystem level (`:`, `/`, `\`). These are replaced with a dash (`-`).

- _Example: `Yahoo!` → `Yahoo!`_.
- _Example: `Last.fm` → `Last.fm`_.
- _Example: `re:start` → `re-start`_.
- _Example: `we://` → `we---`_.

4. We support capitals. Casing is expected to reflect the official service name casing.

- _Example: `hi5` → `hi5`_.
- _Example: `DeviantArt` → `DeviantArt`_.
- _Example: `LINE` → `LINE`_.

5. We support spaces. Spaces are expected to reflect the official service name spacing.

- _Example: `App Store` → `App Store`_.
- _Example: `DeviantArt` → `DeviantArt`_.

6. We prefix the service name by the provider name when self-references are ambiguous, separated by a space. For example, Facebook refers to their Self-serve Ads service simply as “Ads”, which we cannot use in a shared database. We thus call the service “Facebook Ads”.

- _Example: `Ads` (by Facebook) → `Facebook Ads`_.
- _Example: `Analytics` (by Google) → `Google Analytics`_.
- _Example: `Firebase` (by Google) → `Firebase`_.
- _Example: `App Store` (by Apple) → `App Store`_.
