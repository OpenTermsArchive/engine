# CGUs

Tracks and makes visible all changes to the Terms Of Service of online service providers.

> Suit et rend visibles les modifications des Conditions Générales d'Utilisations des principaux fournisseurs de services en ligne.

## Installing

This module is built with [Node](https://nodejs.org/en/). You will need to [install Node](https://nodejs.org/en/download/) to run it.

Clone the repository and install dependencies:

```sh
git clone https://github.com/ambanum/CGUs.git
cd CGUs
npm install
```

## Setting up the database

Initialize the database:
```sh
npm run setup
```

## Configuration

The default configuration can be read and changed in `config/default.json`:

```json
{
  "serviceProvidersPath": "Directory containing providers definition and associated sanitizers.",
  "history": {
    "dataPath": "Database directory path, relative to the root of this project",
    "authoritative": "Boolean. Set to true to push tracked changes to the shared, global database. Should be true only in production.",
    "author": {
      "name": "Name to which changes in tracked documents will be credited",
      "email": "Email to which changes in tracked documents will be credited"
    }
  },
  "notifier": {
    "sendInBlue": {
      "administratorsListId": "SendInBlue contacts list ID of administrators",
      "updatesListId": "SendInBlue contacts list ID of persons to notify on document updates",
      "updateTemplateId": "SendInBlue email template ID used for updates notifications",
      "errorTemplateId": "SendInBlue email template ID used for error notifications",
    }
  }
}
```

## Usage

To get the latest versions of all service providers' terms:

```
npm start
```

The latest version of a document will be available in `/data/sanitized/$service_provider_name/$document_type.md`.

To hourly update documents:

```
npm run start:scheduler
```


## Adding a service provider

In the folder `providers`, create a JSON file with the name of the service provider you want to add, with the following structure:

```json
{
  "serviceProviderName": "<the public name of the service provider>",
  "documents": {
    "<document type>": {
      "url": "<the URL where the document can be found>",
      "contentSelector": "<a CSS selector that targets the meaningful part of the document, excluding elements such as headers, footers and navigation>",
    }
  }
}
```

For the `<document type>` key, you will have to use one of those listed in `/src/documents_types.js` (or create a new one there if it is not already referenced).
You can find examples in the `providers` folder.

## Deploying

See [Ops Readme](ops/README.md).

- - -

## License

The code for this software is distributed under the European Union Public Licence (EUPL) v1.2.
Contact the author if you have any specific need or question regarding licensing.

