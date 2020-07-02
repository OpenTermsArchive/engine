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
# Git clone CGUs data
```

## Setting up the database

You can create a new database to start your own history from now:

```sh
cd ..
mkdir cgus-data
cd cgus-data
git init
```

Or you can download the entire history of terms of services:

```sh
cd ..
git clone https://github.com/ambanum/cgus-data/
```

## Usage

To get the latest versions of all service providers' terms:

```
npm start
```

> You can use the `DATA_PATH` environment variable to specify the absolute location of the database repository (defaults to `../cgus-data` from the root of this repository).

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


