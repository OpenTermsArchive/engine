<div align="center">
  <a href="http://opentermsarchive.org">
    <img width="500" src="http://opentermsarchive.org/images/logo/logo-open-terms-archive-black.png"/>
  </a>
</div>

<br >

<div align="center">
  <strong>Tracks and makes visible changes to the terms of online services</strong>
</div>

<br >

<div align="center">
  <img src="https://github.com/ambanum/OpenTermsArchive/actions/workflows/test.yml/badge.svg"/>
  <img src="https://img.shields.io/npm/v/open-terms-archive?color=blue"/>
  <img src="https://img.shields.io/github/license/ambanum/opentermsarchive?color=lightgrey"/>
</div>


<div align="center">
  <h4>
    <a href="http://opentermsarchive.org">
      Website
    </a>
    <span> | </span>
    <a href="https://twitter.com/openterms">
      Twitter
    </a>
  </h4>
</div>

- - -

**Services** have **terms** written in **documents**, contractual (Terms of Services, Privacy Policy…) or not (Community Guidelines, Deceased User Policy…), that can change over time. Open Terms Archive enables users rights advocates, regulatory bodies and interested citizens to follow the **changes** to these **terms**, to be notified whenever a new **version** is published, to explore their entire **history** and to collaborate in analysing them.

_Note: words in bold are [business domain names](https://en.wikipedia.org/wiki/Domain-driven_design)._

## Table of Contents

- [How it works](#how-it-works)
- [Exploring the versions history](#exploring-the-versions-history)
- [Be notified](#be-notified)
  - [By email](#by-email)
  - [By RSS](#by-rss)
- [Importing as a module](#importing-as-a-module)
  - [CLI](#cli)
  - [Features exposed](#features-exposed)
    - [fetch](#fetch)
    - [filter](#filter)
- [Using locally](#using-locally)
  - [Installing](#installing)
    - [Declarations repository](#declarations-repository)
    - [Core](#core)
  - [Configuring](#configuring)
    - [Configuration file](#configuration-file)
      - [Storage repositories](#storage-repositories)
    - [Environment variables](#environment-variables)
  - [Running](#running)
- [Deploying](#deploying)
- [Publishing](#publishing)
- [Contributing](#contributing)
  - [Adding or updating a service](#adding-a-new-service-or-updating-an-existing-service)
  - [Core engine](#core-engine)
  - [Funding and partnerships](#funding-and-partnerships)
- [License](#license)

## How it works

The document you are reading now is targeted at developers wanting to understand the technicalities and contribute to the project. For a high-level overview of the process, please look at the [public homepage](https://opentermsarchive.org).

### Vocabulary

#### Instances

Open Terms Archive is a decentralised system. It aims at enabling any entity to **track** **terms** on their own and at federating a number of public **instances** in a single ecosystem to maximise discoverability, collaboration and political power.

To that end, the Open Terms Archive **engine** is free and open-source software that can be deployed on any server, making it a dedicated **instance**.

> You can find existing federated public instances on [GitHub](
https://github.com/OpenTermsArchive?q=declarations).

#### Collections

An **instance** **tracks** **documents** of a single **collection**. A **collection** is characterised by a **scope** across **dimensions** such as **language**, **jurisdiction** and **industry**.

To distinguish between the different **terms** of a **service**, each **document** has a **type**, such as “Terms of Service”, “Privacy Policy”, “Developer Agreement”… These **types** match the topic, but not necessarily the title the **service** gives them. Unifying the **types** enables comparing **terms** across **services**.

> The terms types are made available in a [dedicated database](https://github.com/OpenTermsArchive/terms-types) and published on NPM under [`@opentermsarchive/terms-types`](https://www.npmjs.com/package/@opentermsarchive/terms-types), enabling standardisation and interoperability beyond the Open Terms Archive engine.

#### Declarations

The **documents** that constitute a **collection** are defined, along with some metadata on the **service** they relate to, in simple JSON files called **declarations**.

> Here is an example declaration tracking the Privacy Policy of the Open Terms Archive
>
> ```json
> {
>   "name": "Open Terms Archive",
>   "documents": {
>     "Privacy Policy": {
>       "fetch": "https://opentermsarchive.org/privacy-policy",
>       "select": ".TextContent_textContent__ToW2S"
>     }
>   }
> }
> ```

### Processes

#### Acquiring documents

Open Terms Archive **acquires** **documents** to deliver an explorable **history** of **changes**. This can be done in two ways:

1. For the present and future, by **tracking** **documents**.
2. For the past, by **importing** from an existing **fonds** such as [ToSBack](https://tosback.org), the [Internet Archive](https://archive.org/web/), [Common Crawl](https://commoncrawl.org) or any other in-house format.

#### Tracking documents

The **engine** **reads** these **declarations** to **record** a **snapshot** by **fetching** the declared web **location** periodically. The **engine** then **extracts** a **version** from this **snapshot** by:

1. **Selecting** the subset of the **snapshot** that contains the **terms** (instead of navigation menus, footers, cookies banners…).
2. **Removing** residual content in this subset that is not part of the **terms** (ads, illustrative pictures, internal navigation links…).
3. **Filtering noise** by preventing parts that change frequently from triggering false positives for **changes** (tracker identifiers in links, relative dates…). The **engine** can execute custom **filters** written in JavaScript to that end.

After these steps, if **changes** are spotted in the resulting **document**, a new **version** is **recorded**.

Preserving **snapshots** enables recovering after the fact information potentially lost in the **extraction** step: if **declarations** were wrong, they can be **maintained** and corrected **versions** can be **extracted** from the original **snapshots**.

#### Importing documents

Existing **fonds** can be prepared for easier analysis by unifying their format to the **Open Terms Archive dataset format**. This unique format enables building interoperable tools, fostering collaboration across reusers.
Such a dataset can be generated from **versions** alone. If **snapshots** and **declarations** can be retrieved from the **fonds** too, then a full-fledged **collection** can be created.

#### Maintaining declarations

All parts of a **document** **declaration** (web location, selection, noise removal, single or multiple pages distribution…) can change over time. The process of updating these elements to enable continued **tracking** is called **maintenance**. Without it, **documents** can become:

- **unreachable**: no **snapshot** can be **recorded** at all, because the **location** changed or the **service** denies access;
- **unextractable**: no **version** can be **extracted** from the **snapshot**, because the selection of content or some **filter** fails;
- **noisy**: both **snapshots** and **versions** are **recorded** but the **changes** contain **noise** that should have been **filtered out**.

### Governance

#### Creating an instance

Each **instance** has an **administrator** who takes responsibility for ensuring that the **engine** is up to date and works properly, and **maintainers** who take responsibility for ensuring the quality of the resulting **versions**.

All of these roles can be either volunteer or funded by **sponsors**. Anyone is free to create their own **collection** using their own **instance**.

#### Referencing an instance

A **collection** can be **referenced** in the Open Terms Archive **federation** if it abides by the following quality criteria:

1. Clearly defined **scope**.
2. Clearly defined **maintainer**.
3. Clearly defined **administrator**.
4. The vast majority of **versions** are readable.
5. **Frequency** of at least one track a day.
6. Public and open-licensed **snapshots**.
7. Public and open-licensed **versions**.
8. Regular, public, and open-licensed **dataset** releases.

## Importing as a module

Open Terms Archive exposes a JavaScript API to make some of its capabilities available in NodeJS. You can install it as an NPM module:

```
npm install "ambanum/OpenTermsArchive#main"
```

### CLI

The following commands are available where the package is installed:

- `./node_modules/.bin/ota-lint-declarations [service_id]...`: check and normalise the format of declarations.
- `./node_modules/.bin/ota-validate-declarations [service_id]...`: validate declarations.
- `./node_modules/.bin/ota-track [service_id]...`: track services. Recorded snapshots and versions will be stored in the `data` folder at the root of the module where the package is installed.

In order to have them available globally in your command line, install it with the `--global` option.

### API

#### `fetch`

The `fetch` module gets the MIME type and content of a document from its URL. You can use it in your code with `import fetch from 'open-terms-archive/fetch';`.

Documentation on how to use `fetch` is provided [as JSDoc](./src/archivist/fetcher/index.js).

##### `executeClientScripts`

If you pass the `executeClientScripts` option to `fetch`, a headless browser will be used to download and execute the page before serialising its DOM. For performance reasons, the starting and stopping of the browser is your responsibility to avoid instantiating a browser on each fetch. Here is an example on how to use this feature:

```js
import fetch, { launchHeadlessBrowser, stopHeadlessBrowser } from 'open-terms-archive/fetch';

await launchHeadlessBrowser();
await fetch({ executeClientScripts: true, ... });
await fetch({ executeClientScripts: true, ... });
await fetch({ executeClientScripts: true, ... });
await stopHeadlessBrowser();
```

The `fetch` module options are defined as a [`node-config` submodule](https://github.com/node-config/node-config/wiki/Sub-Module-Configuration). If [`node-config`](https://github.com/node-config/node-config) is used in the project, the default `fetcher` configuration can be overridden by adding a `fetcher` object to the [local configuration file](#configuration-file).

#### `filter`

The `filter` module transforms HTML or PDF content into a Markdown string according to a [document declaration](https://github.com/OpenTermsArchive/contrib-declarations/blob/main/CONTRIBUTING.md#declaring-a-new-service). You can use it in your code with `import filter from 'open-terms-archive/filter';`.

The `filter` function documentation is available [as JSDoc](./src/archivist/filter/index.js).

#### `PageDeclaration`

The `PageDeclaration` class encapsulates information about a page tracked by Open Terms Archive. You can use it in your code by using `import pageDeclaration from 'open-terms-archive/page-declaration';`.

## Using locally

### Installing

This module is built with [Node](https://nodejs.org/en/) and is tested on macOS, UNIX and Windows. You will need to [install Node >= v16.x](https://nodejs.org/en/download/) to run it.

#### Declarations repository

1. Locally clone your declarations repository, e.g., `git@github.com:OpenTermsArchive/contrib-declarations.git`.
2. Go into your folder and initialize it, e.g., `cd contrib-declarations; npm install`.
3. You can now modify your declarations in the `./declarations/` folder, following [these instructions](https://github.com/OpenTermsArchive/contrib-declarations/blob/main/CONTRIBUTING.md).
4. When you want to test:
    - If you want to test every declaration, run `npm test`.
    - If you want to test a specific declaration, run `npm test $serviceId`, e.g., `npm test HER`.
    - If you want to have faster feedback on the structure of a specific declaration, run `npm run test:schema $serviceId`, e.g., `npm run test:schema HER`.
5. Once you have done that, if you have any error, it will be prompted and detailed at the end of the test.
    - E.g., `InaccessibleContentError`: Your selector is wrong and should be fixed.
    - E.g., `TypeError`: The file declaration is invalid.
    - E.g., if you have a weird error, you may want to contact OTA, if may be a bug.

##### Note: Testing

Testing works with multiple tests (e.g., checking the validity of the file, that the URL is correct and reachable, that the content is correctly gathered, etc.); as it may take a bit of time, that's why you may want to use `npm run test:schema`.

#### Core

When refering to the base folder, it means the folder where you will be `git pull`ing everything.

1. If not done already, follow the previous part with the repo of your choice.
2. In the base folder of the previous step (i.e., not _in_ the previous folder, but _where the previous folder is_), clone the core engine: `git clone git@github.com:ambanum/OpenTermsArchive.git`.
3. Go into the cloned folder and install dependencies: `cd contrib-declarations; npm install`.
4. If you are using the main repo, you are done, go to step 6.
5. If you are using a special repo instance (e.g., `dating-declarations`), create a new [config file](#configuring), `config/development.json`, and add:
    ```json
    {

      "services": {
        "declarationsPath": "../<name of the repo>/declarations"
      }
    }
    ```
    e.g.,
    ```json
    {
      "services": {
        "declarationsPath": "../dating-declarations/declarations"
      }
    }
    ```
6. In the folder of the repo (i.e., `OpenTermsArchive`), use `npm start`.
    - It will first do a refiltering to check whenever everything works properly.
    - You will then start to see everything being downloaded under `data/`.
    - More details in [Running](#running).

##### Notes: Tips

- You may want to regularly `git pull` to have the latest updates, both in the core engine and in the declarations repos.
- You have to `npm install` in the declarations repo at least once, and a least once each time `package.json` changes.
- Be careful, it doesn't download the history! If you want that, you need to git clone `snapshots` and `versions` in `data/`.

You can clone as many declarations repositories as you want. The one that will be loaded at execution will be defined through configuration.

### Configuring

#### Configuration file

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
    "sendMailOnError": { // Can be set to `false` if you do not want to send email on error
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

The default configuration is merged with (and overridden by) environment-specific configuration that can be specified at startup with the `NODE_ENV` environment variable. For example, you would run `NODE_ENV=development npm start` to load the `development.json` configuration file.

If you want to change your local configuration, we suggest you create a `config/development.json` file with overridden values. Example production configuration files can be found in the `config` folder.

##### Storage repositories

Two storage repositories are currently supported: Git and MongoDB. Each one can be used independently for versions and snapshots.

###### Git

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

###### MongoDB

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

#### Environment variables

Environment variables can be passed in the command-line or provided in a `.env` file at the root of the repository. See [`.env.example`](./.env.example) for an example of such a file.

- `SMTP_PASSWORD`: a password for email server authentication, in order to send email notifications.
- `SENDINBLUE_API_KEY`: a SendInBlue API key, in order to send email notifications with that service.
- `GITHUB_TOKEN`: a token with repository privileges to access the [GitHub API](https://github.com/settings/tokens).

If your infrastructure requires using an outgoing HTTP/HTTPS proxy to access the Internet, you can provide it through the `HTTP_PROXY` and `HTTPS_PROXY` environment variable.

### Running

To get the latest versions of all documents:

```
npm start
```

The latest version of a document will be available in the versions path defined in your configuration, under `$versions_folder/$service_provider_name/$document_type.md`.

To update documents automatically:

```
npm run start:scheduler
```

To get the latest version of a specific service's terms:

```
npm start -- --services <service_id>
```

> The service ID is the case sensitive name of the service declaration file without the extension. For example, for `Twitter.json`, the service ID is `Twitter`.


To get the latest version of a specific service's terms and document type:

```
npm start -- --services <service_id> --documentTypes <document_type>
```

To display help:

```
npm start -- --help
```

## Deploying

See [Ops Readme](ops/README.md).

## Publishing

To generate a dataset:

```
npm run dataset:generate
```

To release a dataset:

```
npm run dataset:release
```

To weekly release a dataset:

```
npm run dataset:scheduler
```

## Contributing

Thanks for wanting to contribute! There are different ways to contribute to Open Terms Archive. We describe the most common below. If you want to explore other venues for contributing, please contact the core team over email at `contact@[project name without spaces].org`.

### Adding a new service or updating an existing service

See [Contributing a document to Open Terms Archive](./docs/doc-contributing.md). You will need knowledge of JSON and web DOM.

### Core engine

To contribute to the core engine of Open Terms Archive, see the [CONTRIBUTING](CONTRIBUTING.md) file of this repository. You will need knowledge of JavaScript and NodeJS.

### Funding and partnerships

Beyond individual contributions, we need funds and committed partners to pay for a core team to maintain and grow Open Terms Archive. If you know of opportunities, please let us know! You can find [on our website](https://opentermsarchive.org/en/about) an up-to-date list of the partners and funders that make Open Terms Archive possible.

- - -

## License

The code for this software is distributed under the [European Union Public Licence (EUPL) v1.2](https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12). In short, this [means](https://choosealicense.com/licenses/eupl-1.2/) you are allowed to read, use, modify and redistribute this source code, as long as you make it clear where it comes from and make available any change you make to it under similar conditions.

Contact the core team over email at `contact@[project name without spaces].org` if you have any specific need or question regarding licensing.
