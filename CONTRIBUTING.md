First off, thanks for taking the time to contribute! 🎉👍

# Adding a service

## Declaring a new service

In the folder `services`, create a JSON file with the name of the service you want to add, with the following structure:

```json
{
  "name": "<the public name of the service>",
  "documents": {
    "<document type>": {
      "fetch": "<an array or service specific filter function name>",
      "filter": "<a selector or an array of selector that targets the meaningful parts of the document, excluding elements such as headers, footers and navigation>",
      "remove": "<a selector or an array of selector that targets the noise parts of the document that has to be removed. Useful to remove parts that are inside the selected parts>",
      "select": "<a selector or an array of selector that targets the meaningful parts of the document, excluding elements such as headers, footers and navigation>",
    }
  }
}
```

### Document type

For the `<document type>` key, you will have to use one of those listed in `/src/types.js` (or create a new one there if it is not already referenced).
You can find examples in the `services` folder.

### Filters

Some documents will need additional filtering beyond simple element deletion and selection to remove noise (changes in textual content that are not meaningful to the terms of services).

These filters are declared as JavaScript functions that modify the downloaded web page through the [DOM API](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model).

Filters take the document as parameter and are:

- **in-place**: they modify the document structure and content directly;
- **idempotent**: they should return the same document structure and content even if run repeatedly on their own result.

Filters are loaded automatically from files named after the service they operate on. For example, filters for the Meetup service, which is declared in `services/Meetup.json`, are loaded from `services/Meetup.filters.js`.

Each filter is exposed as a named function export that takes a `document` parameter and behaves like the `document` object in a browser DOM.

> It is actually a [JSDOM](https://github.com/jsdom/jsdom) document instance.

Learn more about [usual noises](https://github.com/ambanum/CGUs/wiki/Usual-noise).

### Selectors

A selector allows to target a part of the document. It can be of two types, a **css selector** or a **range selector**.

A range selector is defined with a _start_ and an _end_ css selector. It is also necessary to define if the range starts before or after the element targeted by the _start_ css selector and to defined if it ends
before or after the element targeted by the _end_ css selector. To do that, four keys are available to properly describe a range selector `startBefore`, `startAfter`, `endBefore` and `endAfter`.

Thus, a range selector look like this:

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

You can also only validate the schema structure:

```
npm run validate:schema $service_id
```
