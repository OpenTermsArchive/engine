# Open Terms Archive

**Services** have **terms** that can change over time. _Open Terms Archive_ enables users rights advocates, regulatory bodies and any interested citizen to follow the **changes** to these **terms** by being **notified** whenever a new **version** is published, and exploring their entire **history**.

> Les services ont des conditions générales qui évoluent dans le temps. _Open Terms Archive_ permet aux défenseurs des droits des utilisateurs, aux régulateurs et à toute personne intéressée de suivre les évolutions de ces conditions générales en étant notifiée à chaque publication d'une nouvelle version, et en explorant leur historique.

[🇫🇷 Manuel en français](README.fr.md).

## Table of Contents

- [How it works](#how-it-works)
- [Exploring the versions history](#exploring-the-versions-history)
- [Be notified](#be-notified)
  - [By email](#by-email)
  - [By RSS](#by-rss)
- [Reuse](#reuse)
- [Using locally](#using-locally)
  - [Installing](#installing)
    - [Declarations repository](#declarations-repository)
    - [Core](#core)
  - [Configuring](#configuring)
    - [Configuration file](#configuration-file)
      - [Storage adapters](#storage-adapters)
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

_Note: Words in bold are [business domain names](https://en.wikipedia.org/wiki/Domain-driven_design)._

**Services** are **declared** within _Open Terms Archive_ with a **declaration file** listing all the **documents** that, together, constitute the **terms** under which this **service** can be used. These **documents** all have a **type**, such as “terms and conditions”, “privacy policy”, “developer agreement”…

In order to **track** their **changes**, **documents** are periodically obtained by **fetching** a web **location** and **selecting content** within the **web page** to remove the **noise** (ads, navigation menu, login fields…). Beyond selecting a subset of a page, some **documents** have additional **noise** (hashes in links, CSRF tokens…) that would be false positives for **changes**. _Open Terms Archive_ thus supports specific **filters** for each **document**.

However, the shape of that **noise** can change over time. In order to recover in case of information loss during the **noise filtering** step, a **snapshot** is **recorded** every time there is a **change**. After the **noise** is **filtered out** from the **snapshot**, if there are **changes** in the resulting **document**, a new **version** of the **document** is **recorded**.

Anyone can run their own **private** instance and track changes on their own. However, we also **publish** each **version** on a [**public** instance](https://github.com/OpenTermsArchive/contrib-versions) that makes it easy to explore the entire **history** and enables **notifying** over email whenever a new **version** is **recorded**.
Users can [**subscribe** to **notifications**](#be-notified).

_Note: For now, when multiple versions coexist, **terms** are only **tracked** in their English version and for the European jurisdiction._

## Exploring the versions history

We offer a public database of versions recorded each time there is a change in the terms of service and other contractual documents of tracked services: [contrib-versions](https://github.com/OpenTermsArchive/contrib-versions).

From the **repository homepage** [contrib-versions](https://github.com/OpenTermsArchive/contrib-versions), open the folder of the **service of your choice** (e.g. [WhatsApp](https://github.com/OpenTermsArchive/contrib-versions/tree/main/WhatsApp)).

You will see the **set of documents tracked** for that service, now click **on the document of your choice** (e.g. [WhatsApp's Privacy Policy](https://github.com/OpenTermsArchive/contrib-versions/blob/main/WhatsApp/Privacy%20Policy.md)). The **latest version** (updated hourly) will be displayed.

To view the **history of changes** made to this document, click on **History** at the top right of the document (for our previous [example](https://github.com/OpenTermsArchive/contrib-versions/commits/main/WhatsApp/Privacy%20Policy.md)). The **changes** are ordered **by date**, with the latest first.

Click on a change to see what it consists of (for example [this one](https://github.com/OpenTermsArchive/contrib-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd)). There are **two types of display** you can choose from the icons in the gray bar above the document.

- The first one, named _source diff_ (button with chevrons) allows you to **display the old version and the new one side by side** (for our [example](https://github.com/OpenTermsArchive/contrib-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd#diff-e8bdae8692561f60aeac9d27a55e84fc)). This display has the merit of **explicitly showing** all additions and deletions.
- The second one, named _rich diff_ (button with a document icon) allows you to **unify all the changes in a single document** (for our [example](https://github.com/OpenTermsArchive/contrib-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd?short_path=e8bdae8#diff-e8bdae8692561f60aeac9d27a55e84fc)). The **red** color shows **deleted** elements, the **yellow** color shows **modified** paragraphs, and the **green** color shows **added** elements. Be careful, this display **does not show some changes** such as hyperlinks and text style's changes.

### Notes

- For long documents, unchanged **paragraphs will not be displayed by default**. You can manually make them appear by clicking on the small arrows just above or just below the displayed paragraphs.
- You can use the **History button anywhere** in the repository contrib-versions, which will then display the **history of changes made to all documents in the folder** where you are (including sub-folders).

## Be notified

### By email

#### Document per document

You can go on the official front website [opentermsarchive.org](https://opentermsarchive.org). From there, you can select a service and then the corresponding document type.
After you enter your email and click on subscribe, we will add your email to the correspondning mailing list in [SendInBlue](https://www.sendinblue.com/) and will not store your email anywhere else.
Then, everytime a modification is found on the correspondning document, we will send you an email.

You can unsubscribe at any moment by clicking on the `unsubscribe` link at the bottom of the received email.

#### For all documents at once

You can [subscribe](https://59692a77.sibforms.com/serve/MUIEAKuTv3y67e27PkjAiw7UkHCn0qVrcD188cQb-ofHVBGpvdUWQ6EraZ5AIb6vJqz3L8LDvYhEzPb2SE6eGWP35zXrpwEFVJCpGuER9DKPBUrifKScpF_ENMqwE_OiOZ3FdCV2ra-TXQNxB2sTEL13Zj8HU7U0vbbeF7TnbFiW8gGbcOa5liqmMvw_rghnEB2htMQRCk6A3eyj) to receive an email whenever a document is updated in the database.

**Beware, you are likely to receive a large amount of notifications!** You can unsubscribe by replying to any email you will receive.

### By RSS

You can receive notification for a specific service or document by subscribing to RSS feeds.

> An RSS feed is a type of web page that contains information about the latest content published by a website, such as the date of publication and the address where you can view it. When this resource is updated, a feed reader app automatically notifies you and you can see the update.

To find out the address of the RSS feed you want to subscribe to:

1. [Navigate](#exploring-the-versions-history) to the page with the history of changes you are interested in. _In the WhatsApp example above, this would be [this page](https://github.com/OpenTermsArchive/contrib-versions/commits/main/WhatsApp/Privacy%20Policy.md)._
2. Copy the address of that page from your browser’s address bar. _In the WhatsApp example, this would be `https://github.com/OpenTermsArchive/contrib-versions/commits/main/WhatsApp/Privacy%20Policy.md`._
3. Append `.atom` at the end of this address. _In the WhatsApp example, this would become `https://github.com/OpenTermsArchive/contrib-versions/commits/main/WhatsApp/Privacy%20Policy.md.atom`._
4. Subscribe your RSS feed reader to the resulting address.

#### Recap of available RSS feeds

| Updated for                         | URL                                                                                                                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| all services and documents          | `https://github.com/OpenTermsArchive/contrib-versions/commits.atom`                                                                                                                            |
| all the documents of a service      | Replace `$serviceId` with the service ID:<br>`https://github.com/OpenTermsArchive/contrib-versions/commits/main/$serviceId.atom.`                                                            |
| a specific document of a service | Replace `$serviceId` with the service ID and `$documentType` with the document type:<br>`https://github.com/OpenTermsArchive/contrib-versions/commits/main/$serviceId/$documentType.md.atom` |

For example:

- To receive all updates of `Facebook` documents, the URL is `https://github.com/OpenTermsArchive/contrib-versions/commits/main/Facebook.atom`.
- To receive all updates of the `Privacy Policy` from `Google`, the URL is `https://github.com/OpenTermsArchive/contrib-versions/commits/main/Google/Privacy%20Policy.md.atom`.
## Reuse

Open Terms Archive is built on several modules. Some of them are already exposed.

As `open-terms-archive` has not yet been published on npm, you can install it with: 

```
npm install ambanum/OpenTermsArchive#main
```
### scripts
For now, some scripts are exposed through the form of `bin` commands (You can find them in `./bin`)

- `ota-lint-declarations` to lint a json declaration file
- `ota-validate-declarations` to test if a json declaration file is valid.

### features

Some of the main features are also exposed: 

#### fetcher

Fetcher gives the ability to fetch a url and retrieve its mime type and content.

You can use the fetcher in your code by using:

`import fetcher, { launchHeadlessBrowser, stopHeadlessBrowser } from 'open-terms-archive/fetcher'`

Documentation on how to use is provided as JSDoc within `./src/archivist/fetcher/index.js`.

#### filter

Filter gives the ability to transform HTML or pdf content into a markdown string.
It will format content based on the [document declaration](https://github.com/OpenTermsArchive/contrib-declarations/blob/main/CONTRIBUTING.md#declaring-a-new-service) 

You can use the filter in your code by using:

`import filter from 'open-terms-archive/filter';`

Documentation on how to use this is provided as JSDoc within `./src/archivist/filter/index.js`.

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
        "<storage-adapter>": "Storage adapter configuration object; see below"
      }
    },
    "snapshots": {
      "storage": {
        "<storage-adapter>": "Storage adapter configuration object; see below"
      }
    }
  },
  "fetcher": {
    "waitForElementsTimeout": "Maximum time (in milliseconds) to wait for elements to be present in the page when fetching document in a headless browser"
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

If you want to change your local configuration, we suggest you create a `config/development.json` file with overridden values. An example of a production configuration file can be found in `config/production.json`.

##### Storage adapters

Two storage adapters are currently supported: Git and MongoDB. Each one can be used independently for versions and snapshots.

###### Git

```json
{
  …
  "storage": {
    "git": {
      "path": "Versions database directory path, relative to the root of this project",
      "publish": "Boolean. Set to true to push changes to the origin of the cloned repository at the end of every run. Recommended for production only.",
      "prefixMessageToSnapshotId": "Text. Prefix used to explicit where to find the referenced snapshot id. Only useful for versions",
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

Environment variables can be passed in the command-line or provided in a `.env` file at the root of the repository. See `.env.example` for an example of such a file.

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
npm start <service_id>
```

> The service ID is the case sensitive name of the service declaration file without the extension. For example, for `Twitter.json`, the service ID is `Twitter`.

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

Thanks for wanting to contribute! There are different ways to contribute to Open Terms Archive. We describe the most common below. If you want to explore other venues for contributing, please contact us over email (contact@[our domain name]) or [Twitter](https://twitter.com/OpenTerms).

### Adding a new service or updating an existing service

See the [CONTRIBUTING](https://github.com/OpenTermsArchive/contrib-declarations/blob/main/CONTRIBUTING.md) of repository [`OpenTermsArchive/contrib-declarations`](https://github.com/OpenTermsArchive/contrib-declarations). You will need knowledge of JSON and web DOM.

### Core engine

To contribute to the core engine of Open Terms Archive, see the [CONTRIBUTING](CONTRIBUTING.md) file of this repository. You will need knowledge of JavaScript and NodeJS.

### Funding and partnerships

Beyond individual contributions, we need funds and committed partners to pay for a core team to maintain and grow Open Terms Archive. If you know of opportunities, please let us know! You can find [on our website](https://opentermsarchive.org/en/about) an up-to-date list of the partners and funders that make Open Terms Archive possible.


---

## License

The code for this software is distributed under the European Union Public Licence (EUPL) v1.2.
Contact the author if you have any specific need or question regarding licensing.
