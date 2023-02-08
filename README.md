_The document you are reading now is targeted at developers wanting to use or contribute to the engine of [Open Terms Archive](https://opentermsarchive.org). For a high-level overview of Open Terms Archive’s wider goals and processes, please read its [public homepage](https://opentermsarchive.org)._

# Open Terms Archive Engine

This codebase is a Node.js module enabling downloading, archiving and publishing versions of documents obtained online. It can be used independently from the Open Terms Archive ecosystem.

## Table of contents

- [Motivation](#motivation)
- [Main concepts](#main-concepts)
- [How to add documents to a collection](#how-to-add-documents-to-a-collection)
- [How to use the engine](#how-to-use-the-engine)
- [Configuring](#configuring)
- [Deploying](#deploying)
- [Contributing](#contributing)
- [License](#license)

## Motivation

_Words in bold are [business domain names](https://en.wikipedia.org/wiki/Domain-driven_design)._

**Services** have **terms** written in **documents**, contractual (Terms of Services, Privacy Policy…) or not (Community Guidelines, Deceased User Policy…), that can change over time. Open Terms Archive enables users rights advocates, regulatory bodies and interested citizens to follow the **changes** to these **terms**, to be notified whenever a new **version** is published, to explore their entire **history** and to collaborate in analysing them. This free and open-source engine is developed to support these goals.

## Main concepts

### Instances

Open Terms Archive is a decentralised system.

It aims at enabling any entity to **track** **terms** on its own and at federating a number of public **instances** in a single ecosystem to maximise discoverability, collaboration and political power. To that end, the Open Terms Archive **engine** can be run on any server, thus making it a dedicated **instance**.

> Federated public instances can be [found on GitHub](
https://github.com/OpenTermsArchive?q=declarations).

### Collections

An **instance** **tracks** **documents** of a single **collection**.

A **collection** is characterised by a **scope** across **dimensions** that describe the **terms** it **tracks**, such as **language**, **jurisdiction** and **industry**.

> Federated public collections can be [found on GitHub](https://github.com/OpenTermsArchive?q=versions).

#### Example scope

> The documents declared in this collection are:
> - Related to dating services used in Europe.
> - In the European Union and Switzerland jurisdictions.
> - In English, unless no English version exists, in which case the primary official language of the jurisdiction of incorporation of the service operator will be used.

### Terms types

To distinguish between the different **terms** of a **service**, each has a **type**, such as “Terms of Service”, “Privacy Policy”, “Developer Agreement”…

This **type** matches the topic, but not necessarily the title the **service** gives to it. Unifying the **types** enables comparing **terms** across **services**.

> More information on terms types can be found in the [dedicated repository](https://github.com/OpenTermsArchive/terms-types). They are published on NPM under [`@opentermsarchive/terms-types`](https://www.npmjs.com/package/@opentermsarchive/terms-types), enabling standardisation and interoperability beyond the Open Terms Archive engine.

### Declarations

The **documents** that constitute a **collection** are defined in simple JSON files called **declarations**.

A **declaration** also contains some metadata on the **service** the **documents** relate to.

> Here is an example declaration tracking the Privacy Policy of Open Terms Archive:
>
> ```json
> {
>   "name": "Open Terms Archive",
>   "documents": {
>     "Privacy Policy": {
>       "fetch": "https://opentermsarchive.org/en/privacy-policy",
>       "select": ".TextContent_textContent__ToW2S"
>     }
>   }
> }
> ```

## How to add documents to a collection

Open Terms Archive **acquires** **documents** to deliver an explorable **history** of **changes**. This can be done in two ways:

1. For the present and future, by **tracking** **documents**.
2. For the past, by **importing** from an existing **fonds** such as [ToSBack](https://tosback.org), the [Internet Archive](https://archive.org/web/), [Common Crawl](https://commoncrawl.org) or any other in-house format.

### Tracking documents

The **engine** **reads** **declarations** to **record** a **snapshot** by **fetching** the declared web **location** periodically. The **engine** then **extracts** a **version** from this **snapshot** by:

1. **Selecting** the subset of the **snapshot** that contains the **terms** (instead of navigation menus, footers, cookies banners…).
2. **Removing** residual content in this subset that is not part of the **terms** (ads, illustrative pictures, internal navigation links…).
3. **Filtering noise** by preventing parts that change frequently from triggering false positives for **changes** (tracker identifiers in links, relative dates…). The **engine** can execute custom **filters** written in JavaScript to that end.

After these steps, if **changes** are spotted in the resulting **document**, a new **version** is **recorded**.

Preserving **snapshots** enables recovering after the fact information potentially lost in the **extraction** step: if **declarations** were wrong, they can be **maintained** and corrected **versions** can be **extracted** from the original **snapshots**.

### Importing documents

Existing **fonds** can be prepared for easier analysis by unifying their format to the **Open Terms Archive dataset format**. This unique format enables building interoperable tools, fostering collaboration across reusers.
Such a dataset can be generated from **versions** alone. If **snapshots** and **declarations** can be retrieved from the **fonds** too, then a full-fledged **collection** can be created.

## How to use the engine

This documentation describes how to execute the **engine** independently from any specific **instance**. For other use cases, other parts of the documentation could be more relevant:

- to contribute **declarations** to an existing **instance**, see [how to contribute documents](./docs/doc-contributing-documents.md);
- to create a new **collection**, see the [collection bootstrap](https://github.com/OpenTermsArchive/template-declarations) script;
- to create a new public **instance**, see the [governance](./docs/doc-governance.md) documentation.

### Requirements

This module is tested to work across operating systems (continuous testing on UNIX, macOS and Windows).

A [Node.js](https://nodejs.org/en/download/) runtime is required to execute this engine.

![Supported Node.js version can be found in the package.json file](https://img.shields.io/node/v/@opentermsarchive/engine?color=informational&label=Supported%20Node.js%20version)

### Getting started

This engine is published as a [module on NPM](https://npmjs.com/package/@opentermsarchive/engine). The recommended install is as a dependency in a `package.json` file, next to a folder containing [declaration files](#declarations).

```sh
npm install --save @opentermsarchive/engine
mkdir declarations
```

In an editor, create the following declaration file in `declarations/Open Terms Archive.json` to track the terms of the Open Terms Archive website:

```json
{
  "name": "Open Terms Archive",
  "documents": {
    "Privacy Policy": {
      "fetch": "https://opentermsarchive.org/en/privacy-policy",
      "select": ".TextContent_textContent__ToW2S"
    }
  }
}
```

In the terminal:

```sh
npx ota-track
```

The tracked documents can be found in the `data` folder.

This quick example aimed at letting you try the engine quickly. Most likely, you will simply `npm install` from an existing collection, or create a new collection from the [collection template](https://github.com/OpenTermsArchive/template-declarations).

### CLI

Once the engine module is installed as a dependency within another module, the `ota` command with the following subcommands is available.

In these commands:

- **`<service_id>`** is the case sensitive name of the service declaration file without the extension. For example, for `Twitter.json`, the service ID is `Twitter`.
- **`<terms_type>`** is the property name used under the `documents` property in the declaration to declare a terms. For example, in the getting started declaration, the terms type declared is `Privacy Policy`.

#### `ota track`

```sh
npx ota track
```

[Track](#tracking-documents) the current terms of services according to provided declarations.

The declarations, snapshots and versions paths are defined in the [configuration](#configuring).

> Note that the snapshots and versions will be recorded at the moment the command is executed, on top of the existing local history. If a shared history already exists and the goal is to add on top of it, that history has to be downloaded before executing that command.

##### Recap of available options

```sh
npx ota track --help
```

##### Track terms of specific services

```sh
npx ota track --services "<service_id>" ["<service_id>"...]
```

##### Track specific terms of specific services

```sh
npx ota track --services "<service_id>" ["<service_id>"...] --terms-types "<terms_type>" ["<terms_type>"...]
```

##### Track documents four times a day

```sh
npx ota track --schedule
```

#### `ota validate`

```sh
npx ota validate [--services <service_id>...] [--terms-types <terms_type>...]
```

Check that all declarations allow recording a snapshot and a version properly.

If one or several `<service_id>` are provided, check only those services.

##### Validate schema only

```sh
npx ota validate --schema-only [--services <service_id>...] [--terms-types <terms_type>...]
```

Check that all declarations are readable by the engine.

Allows for a much faster check of declarations, but does not check that the documents are actually accessible.

If one or several `<service_id>` are provided, check only those services.

##### Validate modified terms only

```sh
npx ota validate --modified
```

Run [`ota validate`](#ota-validate) only on files that have been modified in Git.

#### `ota lint`

```sh
npx ota lint [--services <service_id>...]
```

Normalise the format of declarations.

Automatically correct formatting mistakes and ensure that all declarations are standardised.

If one or several `<service_id>` are provided, check only those services.

#### `ota dataset`

Export the versions dataset into a ZIP file and publish it to GitHub releases.

The dataset title and the URL of the versions repository are defined in the [configuration](#configuring).

To export the dataset into a local ZIP file:

```sh
npx ota dataset [--file <filename>]
```

To export the dataset into a ZIP file and publish it on GitHub releases:

```sh
GITHUB_TOKEN=ghp_XXXXXXXXX npx ota dataset --publish
```

The `GITHUB_TOKEN` can also be defined in a [`.env` file](#environment-variables).

To export, publish the dataset and remove the local copy that was created after it has been uploaded:

```sh
GITHUB_TOKEN=ghp_XXXXXXXXX npx ota dataset --publish --remove-local-copy
```

To schedule export, publishing and local copy removal:

```sh
GITHUB_TOKEN=ghp_XXXXXXXXX npx ota dataset --schedule --publish --remove-local-copy
```

### API

Once added as a dependency, the engine exposes a JavaScript API that can be called in your own code. The following modules are available.

#### `fetch`

The `fetch` module gets the MIME type and content of a document from its URL

```js
import fetch from '@opentermsarchive/engine/fetch';
```

Documentation on how to use `fetch` is provided [as JSDoc](./src/archivist/fetcher/index.js).

##### Headless browser management

If you pass the `executeClientScripts` option to `fetch`, a headless browser will be used to download and execute the page before serialising its DOM. For performance reasons, the starting and stopping of the browser is your responsibility to avoid instantiating a browser on each fetch. Here is an example on how to use this feature:

```js
import fetch, { launchHeadlessBrowser, stopHeadlessBrowser } from '@opentermsarchive/engine/fetch';

await launchHeadlessBrowser();
await fetch({ executeClientScripts: true, ... });
await fetch({ executeClientScripts: true, ... });
await fetch({ executeClientScripts: true, ... });
await stopHeadlessBrowser();
```

The `fetch` module options are defined as a [`node-config` submodule](https://github.com/node-config/node-config/wiki/Sub-Module-Configuration). The default `fetcher` configuration can be overridden by adding a `fetcher` object to the [local configuration file](#configuration-file).

#### `filter`

The `filter` module transforms HTML or PDF content into a Markdown string according to a [declaration](#declarations).

```js
import filter from '@opentermsarchive/engine/filter';
```

The `filter` function documentation is available [as JSDoc](./src/archivist/filter/index.js).

#### `PageDeclaration`

The `PageDeclaration` class encapsulates information about a page tracked by Open Terms Archive.

```js
import pageDeclaration from '@opentermsarchive/engine/page-declaration';
```

The `PageDeclaration` format is defined [in source code](./src/archivist/services/pageDeclaration.js).

## Configuring

### Configuration file

The default configuration can be found in `config/default.json`. The full reference is given below. You are unlikely to want to edit all of these elements.

```js
{
  "services": {
    "declarationsPath": "Directory containing services declarations and associated filters"
  },
  "recorder": {
    "versions": {
      "storage": {
        "<storage-repository>": "Storage repository configuration object; see below"
      }
    },
    "snapshots": {
      "storage": {
        "<storage-repository>": "Storage repository configuration object; see below"
      }
    }
  },
  "fetcher": {
    "waitForElementsTimeout": "Maximum time (in milliseconds) to wait for elements to be present in the page when fetching document in a headless browser"
    "navigationTimeout": "Maximum time (in milliseconds) to wait for page to load",
    "language": "Language (in ISO 639-1 format) to pass in request headers"
  },
  "notifier": { // Notify specified mailing lists when new versions are recorded
    "sendInBlue": { // SendInBlue API Key is defined in environment variables, see the “Environment variables” section below
      "updatesListId": "SendInBlue contacts list ID of persons to notify on document updates",
      "updateTemplateId": "SendInBlue email template ID used for updates notifications"
    }
  },
  "logger": { // Logging mechanism to be notified upon error
    "smtp": {
      "host": "SMTP server hostname",
      "username": "User for server authentication" // Password for server authentication is defined in environment variables, see the “Environment variables” section below
    },
    "sendMailOnError": { // Can be set to `false` if sending email on error is not needed
      "to": "The address to send the email to in case of an error",
      "from": "The address from which to send the email",
      "sendWarnings": "Boolean. Set to true to also send email in case of warning",
    }
  },
  "tracker": { // Tracking mechanism to create GitHub issues when document content is inaccessible
    "githubIssues": {
      "repository": "GitHub repository where to create isssues",
      "label": {
        "name": "Label to attach to bot-created issues. This specific label will be created automatically in the target repository",
        "color": "The hexadecimal color code for the label, without the leading #",
        "description": "A short description of the label"
      }
    }
  },
  "dataset": { // Release mechanism to create dataset periodically
    "title": "Title of the dataset; recommended to be the name of the instance that generated it",
    "versionsRepositoryURL": "GitHub repository where the dataset will be published as a release; recommended to be the versions repository for discoverability and tagging purposes"
  }
}
```

The default configuration is merged with (and overridden by) environment-specific configuration that can be specified at startup with the `NODE_ENV` environment variable. See [node-config](https://github.com/node-config/node-config) for more information about configuration files.

In order to have a local configuration that override all exisiting config, it is recommended to create a `config/development.json` file with overridden values.

#### Storage repositories

Two storage repositories are currently supported: Git and MongoDB. Each one can be used independently for versions and snapshots.

##### Git

```json
{
  …
  "storage": {
    "git": {
      "path": "Versions database directory path, relative to the root of this project",
      "publish": "Boolean. Set to true to push changes to the origin of the cloned repository at the end of every run. Recommended for production only.",
      "snapshotIdentiferTemplate": "Text. Template used to explicit where to find the referenced snapshot id. Must contain a %SNAPSHOT_ID that will be replaced by the snapshot ID. Only useful for versions",
      "author": {
        "name": "Name to which changes in tracked documents will be credited",
        "email": "Email to which changes in tracked documents will be credited"
      }
    }
  }
  …
}
```
##### MongoDB

```json
{
  …
  "storage": {
    "mongo": {
      "connectionURI": "URI for defining connection to the MongoDB instance. See https://docs.mongodb.com/manual/reference/connection-string/",
      "database": "Database name",
      "collection": "Collection name"
    }
  }
  …
}
```

### Environment variables

Environment variables can be passed in the command-line or provided in a `.env` file at the root of the repository. See `.env.example` for an example of such a file.

- `SMTP_PASSWORD`: a password for email server authentication, in order to send email notifications.
- `SENDINBLUE_API_KEY`: a SendInBlue API key, in order to send email notifications with that service.
- `GITHUB_TOKEN`: a token with repository privileges to access the [GitHub API](https://github.com/settings/tokens).

If an outgoing HTTP/HTTPS proxy to access the Internet is required, it is possible to provide it through the `HTTP_PROXY` and `HTTPS_PROXY` environment variable.

## Deploying

Deployment recipes are available in a [dedicated repository](https://github.com/OpenTermsArchive/deployment). Look at the [README](https://github.com/OpenTermsArchive/deployment#readme) to know how to deploy the engine.
## Contributing

### Getting a copy

In order to edit the code of the engine itself, an editable and executable copy is necessary.

First of all, follow the [requirements](#requirements) above. Then, clone the repository:

```sh
git clone https://github.com/ambanum/OpenTermsArchive.git
cd OpenTermsArchive
```

Install dependencies:

```sh
npm install
```

### Testing

If changes are made to the engine, check that all parts covered by tests still work properly:

```sh
npm test
```

If existing features are changed or new ones are added, relevant tests must be added too.

### Suggesting changes

To contribute to the core engine of Open Terms Archive, see the [CONTRIBUTING](CONTRIBUTING.md) file of this repository. You will need knowledge of JavaScript and Node.js.

### Sponsorship and partnerships

Beyond individual contributions, we need funds and committed partners to pay for a core team to maintain and grow Open Terms Archive. If you know of opportunities, please let us know over email at `contact@[project name without spaces].org`!

- - -

## License

The code for this software is distributed under the [European Union Public Licence (EUPL) v1.2](https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12). In short, this [means](https://choosealicense.com/licenses/eupl-1.2/) you are allowed to read, use, modify and redistribute this source code, as long as you as you credit “Open Terms Archive Contributors” and make available any change you make to it under similar conditions.

Contact the core team over email at `contact@[project name without spaces].org` if you have any specific need or question regarding licensing.
