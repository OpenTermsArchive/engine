First of all, thanks for taking the time to contribute! 🎉👍

## Table of Contents

### Contributing documents

- [Tracking new documents](#tracking-new-documents)
  - [Declaring a new service](#declaring-a-new-service)
    - [Service name](#service-name)
    - [Service ID](#service-id)
    - [Service declaration](#service-declaration)
  - [Declaring documents](#declaring-documents)
    - [`fetch`](#fetch)
    - [`executeClientScripts`](#executeclientscripts)
    - [`select`](#select)
      - [Range selectors](#range-selectors)
    - [`remove`](#remove)
    - [`filter`](#filter)
    - [Document type](#document-type)
      - [Defining a new document type](#defining-a-new-document-type)
  - [Testing your declaration](#testing-your-declaration)
- [Editing existing documents](#editing-existing-documents)
  - [Service history](#service-history)
    - [Document declaration history](#document-declaration-history)
    - [Filters history](#filters-history)
  - [Refiltering your documents](#refiltering-your-documents)

### Contributing code

- [Workflow](#workflow)
  - [Pull requests](#pull-requests)
  - [Peer reviews](#peer-reviews)
  - [Commit messages](#commits-naming-convention)
- [Practices](#practices)
  - [Errors handling](#errors-handling)

---

# Contributing documents

## Tracking new documents

Tracking documents is done by _declaring_ them and the service they are associated with. Such a declaration is achieved by editing JSON files in the [`services`](./services) folder.

Before adding a new document, open the [`services`](./services) folder and check if the service you want to track documents for is already declared. If a JSON file with the name of the service is already present, you can jump straight to [declaring documents](#declaring-documents). Otherwise, keep reading!

### Declaring a new service

Before declaring a service, you will need to choose its name and ID. The ID will be the name of the JSON file in which the service will be declared. It is a normalised version of the service name.

### Service name

The service name is exposed to end users. It should reflect as closely as possible the official service name, as referenced in the terms or “about” pages, so that it can be recognised easily and unambiguously.

- The service name should be the one used by the service itself, no matter the alphabet, UTF symbols, spaces, and casing.
  - _Example: `eBay`_.
  - _Example: `hi5`_.
  - _Example: `LINE`_.
  - _Example: `App Store`_.
  - _Example: `туту.ру` (Cyrillic)_.
  - _Example: `抖音短视频` (Simplified Chinese characters)_.
- Domain name extensions (TLDs) are allowed when they are part of the official service name.
  - _Example: `Booking.com`_.
  - _Example: `historielærer.dk`_.
- Service names can be prefixed by the provider name, separated by a space, when it would otherwise be too generic or ambiguous.
  - _Example: `Ads` (by Facebook) → `Facebook Ads`_.
  - _Example: `Analytics` (by Google) → `Google Analytics`_.
  - _Example: `Firebase` (by Google) → `Firebase`_.
  - _Example: `App Store` (by Apple) → `App Store`_.

> If you have a hard time finding the service name, check out the wiki for [practical guidelines to find the service name](https://github.com/ambanum/OpenTermsArchive/wiki/Naming-services#service-name), and feel free to mention your uncertainties in the pull request! We will help you improve the service name if necessary 🙂

### Service ID

The service ID is exposed to developers. It should be easy to handle with scripts and other tools.

- Non-ASCII characters are not supported. Service IDs are derived from the service name by normalising it into ASCII.
  - _Example: `RTÉ` → `RTE`_.
  - _Example: `historielærer.dk` → `historielaerer.dk`_.
  - _Example: `туту.ру` → `tutu.ru`_.
  - _Example: `抖音短视频` → `Douyin`_.
- Punctuation is supported, except characters that have meaning at filesystem level (`:`, `/`, `\`). These are replaced with a dash (`-`).
  - _Example: `Booking.com` → `Booking.com`_.
  - _Example: `Yahoo!` → `Yahoo!`_.
  - _Example: `re:start` → `re-start`_.
  - _Example: `we://` → `we---`_.
- Capitals and spaces are supported. Casing and spacing are expected to reflect the official service name casing and spacing.
  - _Example: `App Store` → `App Store`_.
  - _Example: `DeviantArt` → `DeviantArt`_.

> If you have a hard time defining the service ID, check out the wiki for [practical guidelines to derive the ID from the service name](https://github.com/ambanum/OpenTermsArchive/wiki/Naming-services#service-id), and feel free to mention your uncertainties in the pull request! We will help you improve the service ID if necessary 🙂

> More details on the ID and naming constraints and recommendations can be found in the relevant [decision record](./decision-records/0001-service-name-and-id.md).

### Service declaration

Once you have the [service name](#service-name) and the [service ID](#service-id), create a JSON file in the `services` folder named after the ID of the service you want to add, with the following structure:

```json
{
  "name": "<service name>",
  "documents": {}
}
```

Within the `documents` JSON object, we will now declare documents.

## Declaring documents

Documents are declared in a service declaration file, under the `documents` property. The way in which each document should be obtained is declared as a JSON object.

```json
  …
  "documents": {
    "<document type>": {
      "fetch": "The URL where the document can be found",
      "executeClientScripts": "A boolean to execute client-side JavaScript loaded by the document before accessing the content, in case the DOM modifications are needed to access the content; defaults to false (fetch HTML only)",
      "filter": "An array of service specific filter function names",
      "remove": "A CSS selector, a range selector or an array of selectors that target the noise parts of the document that has to be removed. Useful to remove parts that are inside the selected parts",
      "select": "A CSS selector, a range selector or an array of selectors that target the meaningful parts of the document, excluding elements such as headers, footers and navigation"
    }
  }
  …
```

> It is worth noting that documents can be tracked as soon as they are _potentially applicable_, even if they are not necessarily _applied_. For example, documents that would start applying at date in the future are legitimate candidates for tracking.

The only mandatory keys are `fetch` and `select` (except for PDF files, for which only `fetch` is needed). Let’s start by defining these keys!

#### `fetch`

This property should simply contain the URL at which the document you want to track can be downloaded. HTML and PDF files are supported.

When multiple versions coexist, **terms are only tracked in their English version and for the European (EEA) jurisdiction**.

> We intend to expand coverage, but we focus for the moment on this subset of documents to fine-tune the system.

#### `executeClientScripts`

In some cases, the content of the document is only loaded (or is modified dynamically) by client scripts.
When set to `true`, this boolean property loads the page in a headless browser to load all assets and execute client scripts before trying to get document content.

Since the performance cost of this approach is high, it is set to `false` by default, relying on the HTML content only.

#### `select`

_This property is not needed for PDF documents._

Most of the time, contractual documents are exposed as web pages, with a header, a footer, navigation menus, possibly ads… We aim at tracking only the significant parts of the document. In order to achieve that, the `select` property allows to extract only those parts in the process of [converting from snapshot to version](./README.md#how-it-works).

The `select` value can be of two types: either a [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors) or a [range selector](#range-selectors).

##### Range selectors

A range selector is defined with a _start_ and an _end_ CSS selector. It is also necessary to define if the range starts before or after the element targeted by the _start_ CSS selector and to define if it ends before or after the element targeted by the _end_ CSS selector.

To that end, a range selector is a JSON object containing two keys out of the four that are available: `startBefore`, `startAfter`, `endBefore` and `endAfter`.

```json
{
  "start[Before|After]": "<CSS selector>",
  "end[Before|After]": "<CSS selector>"
}
```

> For example, the following selector will select the content between the element targeted by the CSS selector `#privacy-eea`, including it, and the element targeted by the CSS selector `#privacy-row`, excluding it:
>
> ```json
> {
>   "startBefore": "#privacy-eea",
>   "endBefore": "#privacy-row"
> }
> ```

#### `remove`

_This property is optional._

Beyond [selecting a subset of a web page](#select), some documents will have non-significant parts in the middle of otherwise significant parts. For example, they can have “go to top” links or banner ads. These can be easily removed by listing [CSS selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors), [range selectors](#range-selectors) or an array of them under the `remove` property.

> Examples:
>
> ```json
> {
>   "fetch": "https://support.google.com/adsense/answer/48182",
>   "select": ".article-container",
>   "remove": ".action-button, .zippy"
> }
> ```
>
> ```json
> {
>   "fetch": "https://www.wechat.com/en/service_terms.html",
>   "select": "#agreement",
>   "remove": {
>     "startBefore": "#wechat-terms-of-service-usa-specific-terms-",
>     "endBefore": "#wechat-terms-of-service-european-union-specific-terms-"
>   }
> }
> ```

#### `filter`

_This property is optional._

Finally, some documents will need more complex filtering beyond simple element selection and removal, for example to remove noise (changes in textual content that are not meaningful to the terms of services). Such filters are declared as JavaScript functions that modify the downloaded web page through the [DOM API](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model).

Filters take the document DOM and the document declaration as parameters and are:

- **in-place**: they modify the document structure and content directly;
- **idempotent**: they should return the same document structure and content even if run repeatedly on their own result.

Filters are loaded automatically from files named after the service they operate on. For example, filters for the Meetup service, which is declared in `services/Meetup.json`, are loaded from `services/Meetup.filters.js`.

The generic function signature for a filter is:

```js
export [async] function filterName(document [, documentDeclaration])
```

Each filter is exposed as a named function export that takes a `document` parameter and behaves like the `document` object in a browser DOM. These functions can be `async`, but they will still run sequentially.

> The `document` parameter is actually a [JSDOM](https://github.com/jsdom/jsdom) document instance.

The second parameter contains the whole document declaration. It can be useful if you need to access the defined document URL or selector inside your filter.

For example, you can scope the selection in your filter with the `selector` defined in the document declaration:

```js
export function removeImages(document, { select: selector }) {
  const images = document.querySelectorAll(`${selector} img`);
  images.forEach((el) => el.remove());
}
```

You can find examples of filters in [`/services/*.filters.js`](./services) files.

Also, filters used on many services has been extracted for better reusability in `services/_common.filters.js`.
You can use them in your filters file with `export { removeSIDfromUrls } from './_common.filters.js';`

You can also learn more about [usual noise](https://github.com/ambanum/OpenTermsArchive/wiki/Usual-noise) and ways to handle it on the wiki, and share your own learnings there.

#### Document type

Great, your document declaration is now almost complete! We simply need to write it under the appropriate document type in the `documents` JSON object within the service declaration. In order to distinguish between the many documents that can be associated with a service and enable cross-services comparison of similar documents, we maintain a unique list of document types. You can find the list of allowed values for the `<document type>` key in [`/src/archivist/types.json`](./src/archivist/types.json).

The types might not always match the exact name given by the service provider. For example, some providers might call their document “Terms and Conditions” or “Terms of Use” instead of “Terms of Service”. The document type does not have to match the exact name, it only has to match the _commitment_ that is taken.

If the document you want to add matches no existing document type, you can create a new one in the same pull request in which you declare the service that would use it. If you're in doubt, please list the potential synonyms you have considered, we will help you find the most appropriate one 🙂

##### Defining a new document type

Before defining a new document type, please note that wanting to multiply documents types is usually a symptom that the service needs to be broken down into several services. For example, rather than considering that Facebook has several specific variations of “Terms of Service”, it is more accurate to declare “Terms of Service” documents for the “Facebook” (social network service for the general public), “Facebook Ads” (ads service for advertisers) and “Facebook Payments” (payment service for developers) services. On the other hand, the “Google Ads” service is a commercial suite acting as an umbrella for several pieces of software that all share the same contractual documents, and there is thus no need to separate each of them. See practical guidelines for [provider prefixing](https://github.com/ambanum/OpenTermsArchive/wiki/Naming-services#provider-prefixing) on the wiki.

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

Please note that we do not want [service-specific types](https://github.com/ambanum/OpenTermsArchive/pull/89) such as “Twitter Privacy Policy”. Document types should be generic, even if only one service uses them at a given time. Otherwise, duplication occurs and [important efforts](https://github.com/ambanum/OpenTermsArchive/pull/88) have to be deployed to deduplicate. The triptych form “writer / audience / object” is precisely used to avoid this sort of duplication.

### Testing your declaration

You can test the declarations you created or changed by running the following command:

```
npm run validate:modified
```

> You can also validate any arbitrary service with `npm run validate $service_id [, $service_id …]`.

Since this operation fetches documents and could be long, you can also validate the declaration structure only:

```
npm run validate:schema [$service_id [, $service_id …]]
```

## Editing existing documents

As services evolve, document declarations are also expected to change over time. The service provider can change the document's URL or the document's HTML structure, thus their fetch location, selectors or filters can change.
OpenTermsArchive needs to keep track of this changes in order to regenerate versions history from snapshots history.

### Service history

To keep track of services declarations and filters changes, Open Terms Archive offers a versioning system. It is optional and should be added only when needed. It works by creating history files for documents declarations and filters, where each entry should be a previous valid declaration or filter function and should have an expiry date.

Both for documents and filters history, the expiration date is declared in a property `validUntil`. It should be the authored date and time of the last snapshot commit for which the declaration is still valid.

Documents declarations history files and filters history files can both evolve on their own. Having one does not imply to create the other.

The current (latest) valid declaration has no date and should not appear in the history object: it stays in its own file, just like if there was no history at all.

#### Document declaration history

Declarations history are stored in a history JSON file with the following name `services/$service_id.history.json`.

The document history contains an object with document types as properties. Each document type property is an array of history entries. Each entry has the same format as a normal document declaration, except there is the **mandatory** extra property `validUntil`.

```json
{
  …
  "<document type>": [
    {
      "fetch": "The URL where the document can be found",
      "executeClientScripts": "A boolean to execute client-side JavaScript loaded by the document before accessing the content, in case the DOM modifications are needed to access the content; defaults to false (fetch HTML only)",
      "filter": "An array of service specific filter function names",
      "remove": "A CSS selector, a range selector or an array of selectors that target the noise parts of the document that has to be removed. Useful to remove parts that are inside the selected parts",
      "select": "A CSS selector, a range selector or an array of selectors that target the meaningful parts of the document, excluding elements such as headers, footers and navigation",
      "validUntil": "The inclusive expiration date in ISO format"
    }
  ]
  …
}
```

For example, to add a history entry for the `Terms of Service` of the service `ASKfm`, create the file `services/ASKfm.history.json` with the following contents:

```json
{
  "Terms of Service": [
    {
      "fetch": "https://ask.fm/docs/terms_of_use/?lang=en",
      "select": "body",
      "filter": ["add"],
      "validUntil": "2020-10-29T21:30:00.000Z"
    }
  ]
}
```

#### Filters history

Filters history is declared in a filters history declaration JavaScript file with the following name: `services/$service_id.filters.history.js`.

For each filter, a variable named like the filter must be exported. This variable should contain an array of filter history entries. Each entry is an object with the expiration date, as `validUntil` property, and the valid function for this date, under the `filter` property. Both properties are **mandatory**.

```js
export const <filterName> = [
  {
    validUntil: "The inclusive expiration date in ISO format",
    filter: function() { /* body valid until the expiration of the `validUntil` date */ }
  }
];
```

For example, to add a history entry for the `removeSharesButton` filter of the service `ASKfm`, create the file `services/ASKfm.filters.history.js` with the following content:

```js
export const removeSharesButton = [
  {
    validUntil: '2020-08-22T11:30:21.000Z',
    filter: async (document) => {
      document.querySelectorAll('.shares').forEach((element) => element.remove());
    },
  },
];
```

### Refiltering your documents

If you change filters or selectors and want to re-apply them on previously fetched documents from snapshots and regenerate versions only:

```
npm run refilter [$service_id]
```

# Contributing code

## Workflow
### Pull requests

We follow the [GitHub Flow](https://guides.github.com/introduction/flow/): all code contributions are submitted via a pull request towards the `master` branch.

Opening a Pull Request means you want that code to be merged. If you want to only discuss it, send a link to your branch along with your questions through whichever communication channel you prefer.

#### Peer reviews

All pull requests must be reviewed by at least one person who is not their original author.

To help reviewers, make sure to describe your pull request with a **clear text explanation** of your changes.

### Commit messages

We strive to follow this [recommendation](https://chris.beams.io/posts/git-commit) to write our commit messages, which contains the following rules:

- [Separate subject from body with a blank line](https://chris.beams.io/posts/git-commit/#separate).
- [Limit the subject line to 50 characters](https://chris.beams.io/posts/git-commit/#limit-50).
- [Capitalize the subject line](https://chris.beams.io/posts/git-commit/#capitalize).
- [Do not end the subject line with a period](https://chris.beams.io/posts/git-commit/#end).
- [Use the imperative mood in the subject line](https://chris.beams.io/posts/git-commit/#imperative).
- [Wrap the body at 72 characters](https://chris.beams.io/posts/git-commit/#wrap-72).
- [Use the body to explain what and why vs. how](https://chris.beams.io/posts/git-commit/#why-not-how).

We add this additional rule:

- Do not rely on GitHub issue reference numbers in commit messages, as we have no guarantee the host system and its autolinking will be stable in time. Make sure the context is self-explanatory. If an external reference is given, use its full URL.

## Practices

### Errors handling

First of all it's important to distinguish two fundamentally different kinds of errors: **operational** and **programmer** errors.

- **Operational errors represent run-time problems experienced by correctly-written programs**. These are not bugs in the program. These are usually problems with something else: the system itself (e.g. out of memory), the system’s configuration (e.g. no route to a remote host), the network (e.g. socket hang-up), or a remote service (e.g. a 500 error).

- **Programmer errors are bugs in the program**. These are things that can always be avoided by changing the code. They can never be handled properly, since by definition the code in question is broken (e.g. tried to read property of `undefined`, or forget to `await` an asynchronous function).

So the very important distinction is that operational errors are part of the **normal operation of a program** whereas programmer errors are **bugs**.

Also noteworthy, failure to handle an operational error is itself a programmer error.

#### Handling operational errors

There are five ways to handle operational errors:
- **Deal with the failure directly**. For example, create directory if it's missing.
- **Propagate the failure**. If you don’t know how to deal with the error, the simplest thing to do is to abort whatever operation you’re trying to do, clean up whatever you’ve started, and propagate the error.
- **Retry the operation**. For example, try to reconnect if the connection is lost.
- **Log the error — and do nothing else**. If it's a minor error and there’s nothing you can do about, and there is no reason to stop the whole process.
- **Crash immediately**. If the error cannot be handled and can affect data integrity.

In our case, we consider all `fetch`-related errors as expected, so as operational errors and we handle them by logging but we do not stop the whole process. We handle errors related to the `notifier` in the same way.
In contrast, we consider errors from the `history` module as fatal, and we crash immediately.

#### Handling programmer errors

**The best way to handle programmer errors is to crash immediately.** Indeed, it is not recommended to attempt to recover from programmer errors — that is, allow the current operation to fail, but keep handling requests. Consider that a programmer error is a case that you didn’t think about when you wrote the original code. How can you be sure that the problem won’t affect the program itself and the data integrity?

This section is highly inspired, and in part extracted, from [this error handling guide](https://www.joyent.com/node-js/production/design/errors).
