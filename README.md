# CGUs

Tracks and makes visible all changes to the Terms Of Service of online service providers.

> Suit et rend visibles les modifications des Conditions Générales d'Utilisations des principaux fournisseurs de services en ligne.

## Installation

This API is built with [Node](https://nodejs.org/en/). You will need to [install it](https://nodejs.org/en/download/) to run this application.

Clone the repository and install dependencies:

```sh
git clone https://github.com/ambanum/CGUs.git
cd CGUs
npm install
```

## Usage

To get lastest versions of service providers' terms:

```
npm start
```

The lastest version will be available in `/data/sanitized/<service_provider_name>/<document_type>.md`.

To hourly update documents:

```
npm run start:scheduler
```

## Add a service provider

In the folder `providers`, create a JSON file with the name of the service provider who want to add with following structure:

```json
{
  "serviceProviderName": "<the public name of the service provider>",
  "documents": {
    "<document type>": {
      "url": "<the url where the document can be found>",
      "contentSelector": "<the css selector on the meaningful content of the document>",
    }
  }
}
```

For document type [there is a list of available documents types](/src/documents_types.js)
You can find examples in `providers` folder.

## Deployment

See [Ops Readme](ops/README.md).

- - -

## License

The code for this software is distributed under the European Union Public Licence (EUPL) v1.2.
Contact the author if you have any specific need or question regarding licensing.


