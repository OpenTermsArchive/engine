First off, thanks for taking the time to contribute! 🎉👍

# Adding a service

## Declaring a new service

In the folder `services`, create a JSON file with the name of the service you want to add, with the following structure:

```json
{
  "name": "<the public name of the service>",
  "documents": {
    "<document type>": {
      "fetch": "<the URL where the document can be found>",
      "filter": "<an array of service specific filter function names>",
      "remove": "<a CSS selector, a range selector or an array of selectors that target the noise parts of the document that has to be removed. Useful to remove parts that are inside the selected parts>",
      "select": "<a CSS selector, a range selector or an array of selectors that target the meaningful parts of the document, excluding elements such as headers, footers and navigation>",
    }
  }
}
```

You can find examples in the `services` folder.

### Document type

You can find the list of allowed values for the `<document type>` key in `/src/types.json`.

The types might not always match the exact name given by the service provider. For example, some providers might call their document “Terms and Conditions” or “Terms of Use” instead of “Terms of Service”. The document type does not have to match the exact name, it only has to match the _commitment_ that is taken.

> This model enables comparing documents across providers as long as they cover similar commitments, notwithstanding their given name.

In order to guide usage and disambiguate synonyms, we characterise each document type along three dimensions of the commitment that is being taken in it:

1. The `writer` of the document;
2. the targeted `audience`;
3. the `object` of the commitment.

A document type thus looks like:

```json
{
  …
  "Privacy Policy": {
    "commitment": {
      "writer": "service provider",
      "audience": "end user",
      "object": "personal data"
    }
  },
  …
}
```

#### Defining a new document type

If the document you want to add matches no existing document type, you can create a new one in the same pull request in which you declare the service that would use it.

If you're in doubt, please list the potential synonyms you have considered.

### Filters

Some documents will need additional filtering beyond simple element deletion and selection to remove noise (changes in textual content that are not meaningful to the terms of services).

These filters are declared as JavaScript functions that modify the downloaded web page through the [DOM API](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model).

Filters take the document as parameter and are:

- **in-place**: they modify the document structure and content directly;
- **idempotent**: they should return the same document structure and content even if run repeatedly on their own result.

Filters are loaded automatically from files named after the service they operate on. For example, filters for the Meetup service, which is declared in `services/Meetup.json`, are loaded from `services/Meetup.filters.js`.

Each filter is exposed as a named function export that takes a `document` parameter and behaves like the `document` object in a browser DOM.

> It is actually a [JSDOM](https://github.com/jsdom/jsdom) document instance.

Learn more about [usual noise](https://github.com/ambanum/CGUs/wiki/Usual-noise).

### Selectors

A selector allows to target a part of the document. It can be of two types, a [**css selector**](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors) or a **range selector**.

A range selector is defined with a _start_ and an _end_ css selector. It is also necessary to define if the range starts before or after the element targeted by the _start_ css selector and to define if it ends
before or after the element targeted by the _end_ css selector. To do that, four keys are available to properly describe a range selector: `startBefore`, `startAfter`, `endBefore` and `endAfter`.

Thus, a range selector looks like this:

```json
{
  "start[Before|After]": "<css selector>",
  "end[Before|After]": "<css selector>"
}
```

For example, the following selector will select the content between the element targeted by the css selector `#privacy-eea`, including it, and the element targeted by the css selector `#privacy-row`, excluding it:

```json
{
  "startBefore": "#privacy-eea",
  "endBefore": "#privacy-row"
}
```

### Selecting jurisdiction and language

For now, when multiple versions coexist, terms are only tracked in their English version and for the European (EEA) jurisdiction.


## Test your declaration

Test the declaration by running the following command with the service id:

```
npm run validate $service_id
```

> The service id is the case sensitive name of the service declaration file without the extension. For example, for `Twitter.json`, the service id is `Twitter`.

Since this operation fetches documents and could be long, you can also validate the declaration structure only:

```
npm run validate:schema $service_id
```
