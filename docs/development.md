# Development

## Installation

This module is built with [Node](https://nodejs.org/en/) and is tested on macOS, UNIX and Windows. You will need to [install Node >= v16.x](https://nodejs.org/en/download/) to run it.

Clone repository and install dependencies:

```bash
git clone https://github.com/ambanum/OpenTermsArchive.git
cd OpenTermsArchive
npm install
```

It is then possible to create declarations from scratch or by using already defined declarations. 

> To create a declarations repository from scratch, [this template](https://github.com/OpenTermsArchive/template-declarations) can be used as it or as inspiration.

For this walkthrough, let's use existing declarations (e.g. `OpenTermsArchive/contrib-declarations`) by cloning its repository next to the `OpenTermsArchive` project root directory:


```bash
cd ..
git clone https://github.com/OpenTermsArchive/contrib-declarations.git declarations
```
Go into the declarations folder and install dependencies:

```bash
cd declarations
npm install
```

## Usage

Track documents:

```
npm start
```

Snapshots and versions will start to being downloaded under paths defined in the configuration (see [configuration](#configuration)), with `./data` as default path.
Thus latest version of a document will be available under this path, with the following structure: `$versions_folder/$service_provider_name/$document_type.md`.

> Note that it doesn't download the whole history. Snapshots and versions repositories must be cloned independently to have access to the history.

Track a specific service's terms:

```
npm start -- --services <service_id>
```

> The service ID is the case sensitive name of the service declaration file without the extension. For example, for `Twitter.json`, the service ID is `Twitter`.


Track a specific service's terms and terms type:

```
npm start -- --services <service_id> --documentTypes <terms_type>
```

Schedule documents tracking multiple times a day:

```
npm run start:scheduler
```

Display help:

```
npm start -- --help
```

## Configuration

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

The default configuration is merged with (and overridden by) environment-specific configuration that can be specified at startup with the `NODE_ENV` environment variable. For example, running `NODE_ENV=vagrant npm start` will load the `vagrant.json` configuration file. See [node-config](https://github.com/node-config/node-config) for more information about configuration files.

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

## Test

If modification are made to the engine, it's recommended to check that all parts covered by tests still works properly by running tests:

```
npm test
```

## Deploy

See [Open Terms Archive deployment Ansible collection](https://github.com/OpenTermsArchive/ota.deployment-ansible-collection).

## Publish

Generate a dataset:

```
npm run dataset:generate
```

Release a dataset on GitHub:

```
npm run dataset:release
```

Schedule a weekly release of the dataset:

```
npm run dataset:scheduler
```
