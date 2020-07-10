First off, thanks for taking the time to contribute! 🎉👍

# Adding a service

## Declaring a new service

In the folder `services`, create a JSON file with the name of the service you want to add, with the following structure:

```json
{
  "name": "<the public name of the service>",
  "documents": {
    "<document type>": {
      "location": "<the URL where the document can be found>",
      "contentSelector": "<a CSS selector that targets the meaningful part of the document, excluding elements such as headers, footers and navigation>",
    }
  }
}
```

For the `<document type>` key, you will have to use one of those listed in `/src/types.js` (or create a new one there if it is not already referenced).
You can find examples in the `services` folder.

Test the declaration by running the following command with the service id:

_Note: the service id is the case sensitive name of the service declaration file without the extension. For example, for `Twitter.json`, the service id is `Twitter`._

```
npm run validate $service_id
```

## Filters

Some documents will need additional filtering beyond simple element selection to remove noise (changes in textual content that are not meaningful to the terms of services).

These filters are declared as JavaScript functions that modify the downloaded web page through the [DOM API](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model).

Filters take the document as parameter and are:

- **in-place**: they modify the document structure and content directly;
- **idempotent**: they should return the same document structure and content even if run repeatedly on their own result.

Filters are loaded automatically from files named after the service they operate on. For example, filters for the Meetup service, which is declared in `services/Meetup.json`, are loaded from `services/Meetup.filters.js`.

Each filter is exposed as a named function export that takes a `document` parameter and behaves like the `document` object in a browser DOM.

> It is actually a [JSDOM](https://github.com/jsdom/jsdom) document instance.
