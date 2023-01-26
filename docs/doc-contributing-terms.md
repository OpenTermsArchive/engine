# Contributing terms

## Tracking new terms

Tracking terms is done by _declaring_ them and the service they are associated with. Such a declaration is achieved by editing JSON files in the [`declarations`](./declarations) folder.

Before adding a new terms, open the [`declarations`](./declarations) folder and check if the service you want to track terms for is already declared. If a JSON file with the name of the service is already present, you can jump straight to [declaring terms](#declaring-terms). Otherwise, keep reading!

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

> If you have a hard time finding the service name, check out the [practical guidelines to find the service name](declarations-guidelines.md#service-name), and feel free to mention your uncertainties in the pull request! We will help you improve the service name if necessary 🙂

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

> If you have a hard time defining the service ID, check out the [practical guidelines to derive the ID from the service name](declarations-guidelines.md#service-id), and feel free to mention your uncertainties in the pull request! We will help you improve the service ID if necessary 🙂

> More details on the ID and naming constraints and recommendations can be found in the relevant [decision record](https://github.com/ambanum/OpenTermsArchive/blob/main/decision-records/0001-service-name-and-id.md).

### Service declaration

Once you have the [service name](#service-name) and the [service ID](#service-id), create a JSON file in the `declarations` folder named after the ID of the service you want to add, with the following structure:

```json
{
  "name": "<service name>",
  "documents": {}
}
```

Within the `documents` JSON object, we will now declare terms.

## Declaring terms

Terms are declared in a service declaration file, under the `documents` property. The way in which each terms should be obtained is declared as a JSON object.

```json
  …
  "documents": {
    "<terms type>": {
      "fetch": "The URL where the document can be found",
      "executeClientScripts": "A boolean to execute client-side JavaScript loaded by the document before accessing the content, in case the DOM modifications are needed to access the content; defaults to false (fetch HTML only)",
      "filter": "An array of service specific filter function names",
      "remove": "A CSS selector, a range selector or an array of selectors that target the noise parts of the document that has to be removed. Useful to remove parts that are inside the selected parts",
      "select": "A CSS selector, a range selector or an array of selectors that target the meaningful parts of the document, excluding elements such as headers, footers and navigation"
    }
  }
  …
```

- For HTML files, `fetch` and `select` are mandatory.
- For PDF files, only `fetch` is mandatory.

Let’s start by defining these keys!

#### `fetch`

This property should simply contain the URL at which the terms you want to track can be downloaded. HTML and PDF files are supported.

When terms coexist in different languages and jurisdictions, please refer to the [scope of the collection](../README.md#collections) to which you are contributing. This scope is usually defined in the README.

#### `select`

_This property is not needed for PDF documents._

Most of the time, contractual documents are exposed as web pages, with a header, a footer, navigation menus, possibly ads… We aim at tracking only the significant parts of the document. In order to achieve that, the `select` property allows to extract only those parts in the process of [converting from snapshot to version](../README.md#how-it-works).

The `select` value can be either a [CSS selector](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors), a [range selector](#range-selectors) or an array of those.

##### CSS selectors

CSS selectors should be provided as a string. See the [specification](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors) for how to write CSS selectors.

> For example, the following selector will select the content in the `<main>` tag of the HTML document:
>
> ```json
> "select": "main"
> ```

##### Range selectors

A range selector is defined with a _start_ and an _end_ CSS selector. It is also necessary to define if the range starts before or after the element targeted by the _start_ CSS selector and to define if it ends before or after the element targeted by the _end_ CSS selector.

To that end, a range selector is a JSON object containing two keys out of the four that are available: `startBefore`, `startAfter`, `endBefore` and `endAfter`.

```json
{
  "start[Before|After]": "<CSS selector>",
  "end[Before|After]": "<CSS selector>"
}
```

> For example, the following selector will select the content between the element targeted by the CSS selector `#privacy-eea`, including it, and the element targeted by the CSS selector `footer`, excluding it:
>
> ```json
> {
>   "startBefore": "#privacy-eea",
>   "endBefore": "footer"
> }
> ```

#### `remove`

_This property is optional._

Beyond [selecting a subset of a web page](#select), some documents will have non-significant parts in the middle of otherwise significant parts. For example, they can have “go to top” links or banner ads. These can be removed by listing [CSS selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors), [range selectors](#range-selectors) or an array of them under the `remove` property.

##### Example

Let's assume a web page contains the following content:

```html
<main>
  <div class="filter-holder">
    <select class="filter-options">
        <option value="https://www.example.com/policies/user-agreement" selected>User Agreement</option>
        <option value="https://www.example.com/policies/privacy-policy">Privacy Policy</option>
        <option value="https://www.example.com/policies/content-policy">Content Policy</option>
        <option value="https://www.example.com/policies/broadcasting-content-policy">Broadcasting Content Policy</option>
    </select>
  </div>
  <h1>User Agreement</h1>
  <div>…terms…</div>
</main>
```

If only `main` is used in `select`, the following version will be extracted:

```md
User Agreement Privacy Policy Content Policy Broadcasting Content Policy Moderator Guidelines Transparency Report 2017 Transparency Report 2018 Guidelines for Law Enforcement Transparency Report 2019

User Agreement
==============

…terms…
```

Whereas we want instead:

```md
User Agreement
==============

…terms…
```

This result can be obtained with the following declaration:

```json
{
  "fetch": "https://example.com/user-agreement",
  "select": "main",
  "remove": ".filter-holder"
}
```

##### Complex selectors examples

```json
{
 "fetch": "https://support.google.com/adsense/answer/48182",
 "select": ".article-container",
 "remove": ".print-button, .go-to-top"
}
```

```json
{
 "fetch": "https://www.wechat.com/en/service_terms.html",
 "select": "#agreement",
 "remove": {
   "startBefore": "#wechat-terms-of-service-usa-specific-terms-",
   "endBefore": "#wechat-terms-of-service-european-union-specific-terms-"
 }
}
```

```json
{
 "fetch": "https://fr-fr.facebook.com/legal/terms/plain_text_terms",
 "select": "div[role=main]",
 "remove": [
   {
     "startBefore": "[role=\"separator\"]",
     "endAfter": "body"
   },
   "[style=\"display:none\"]"
 ]
}
```

#### `executeClientScripts`

_This property is optional._

In some cases, the content of the document is only loaded (or is modified dynamically) by client scripts.
When set to `true`, this boolean property loads the page in a headless browser to load all assets and execute client scripts before trying to get the document contents.

Since the performance cost of this approach is high, it is set to `false` by default, relying on the HTML content only.

#### `filter`

_This property is optional._

Finally, some documents will need more complex filtering beyond simple element selection and removal, for example to remove noise (changes in textual content that are not meaningful to the terms of services). Such filters are declared as JavaScript functions that modify the downloaded web page through the [DOM API](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model).

Filters take the document DOM and the terms declaration as parameters and are:

- **in-place**: they modify the document structure and content directly;
- **idempotent**: they should return the same document structure and content even if run repeatedly on their own result.

Filters are loaded automatically from files named after the service they operate on. For example, filters for the Meetup service, which is declared in `declarations/Meetup.json`, are loaded from `declarations/Meetup.filters.js`.

The generic function signature for a filter is:

```js
export [async] function filterName(document, documentDeclaration)
```

Each filter is exposed as a named function export that takes a `document` parameter and behaves like the `document` object in a browser DOM. These functions can be `async`, but they will still run sequentially. The whole document declaration is passed as second parameter.

> The `document` parameter is actually a [JSDOM](https://github.com/jsdom/jsdom) document instance.

You can learn more about usual noise and ways to handle it [in the guidelines](declarations-guidelines.md#Usual-noise).

##### Example

Let's assume a service adds a unique `clickId` parameter in the query string of all link destinations. These parameters change on each page load, leading to recording noise in versions. Since links should still be recorded, it is not appropriate to use `remove` to remove the links entirely. Instead, a filter will manipulate the links destinations to remove the always-changing parameter. Concretely, the goal is to apply the following filter:

```diff
- Read the <a href="https://example.com/example-page?clickId=349A2033B&lang=en">list of our affiliates</a>.
+ Read the <a href="https://example.com/example-page?lang=en">list of our affiliates</a>.
```

The code below implements this filter:

```js
function removeTrackingIdsQueryParam(document) {
  const QUERY_PARAM_TO_REMOVE = 'clickId';

  document.querySelectorAll('a').forEach(link => {  // iterate over every link in the page
    const url = new URL(link.getAttribute('href'), document.location);  // URL is part of the DOM API, see https://developer.mozilla.org/en-US/docs/Web/API/URL
    const params = new URLSearchParams(url.search);  // URLSearchParams is part of the DOM API, see https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams

    params.delete(QUERY_PARAM_TO_REMOVE);  // we use the DOM API instead of RegExp because we can't know in advance in which order parameters will be written
    url.search = params.toString();  // store the query string without the parameter
    link.setAttribute('href', url.toString());  // write the destination URL without the parameter
  });
}
```

##### Example usage of declaration parameter

The second parameter can be used to access the defined document URL or selector inside the filter.

Let's assume a service stores some of its legally-binding terms in images. To track these changes properly, images should be stored as part of the terms. By default, images are not stored since they significantly increase the document size. The filter below will store images inline in the terms, encoded in a [data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs). In order to download the images for conversion, the base URL of the web page is needed to resolve relative links. This information is obtained from the declaration.

```js
import fetch from 'isomorphic-fetch';

export async function convertImagesToBase64(document, documentDeclaration) {
  const { fetch: baseUrl, select: selector } = documentDeclaration;
  
  const images = Array.from(document.querySelectorAll(`${selector} img`));

  return Promise.all(images.map(async ({ src }, index) => {
    const imageAbsoluteUrl = new URL(src, baseUrl).href;
    const response = await fetch(imageAbsoluteUrl);
    const mimeType = response.headers.get('content-type');
    const content = await response.arrayBuffer();

    const base64Image = btoa(String.fromCharCode(...new Uint8Array(content)));

    images[index].src = `data:${mimeType};base64,${base64Image}`;
  }));
}
```

#### Terms type

Great, your terms declaration is now almost complete! We simply need to write it under the appropriate terms type in the `documents` JSON object within the service declaration. In order to distinguish between the many terms that can be associated with a service and enable cross-services comparison of similar terms, we maintain a unique list of terms types.
You can find more information and the list of allowed values for the `<terms type>` key in the [dedicated repository](https://github.com/OpenTermsArchive/terms-types).

The types might not always match the exact name given by the service provider. For example, some providers might call their terms “Terms and Conditions” or “Terms of Use” instead of “Terms of Service”. The terms type does not have to match the exact name, it only has to match the _commitment_ that is taken.

If the terms you want to add match no existing type, you can [suggest a new one](https://github.com/ambanum/OpenTermsArchive/discussions/categories/document-types).

##### Defining new terms types

Before defining a new terms type, please note that wanting to multiply terms types is usually a symptom that the service needs to be broken down into several services. For example, rather than considering that Facebook has several specific variations of “Terms of Service”, it is more accurate to declare “Terms of Service” terms for the services “Facebook” (social network service for the general public), “Facebook Ads” (ads service for advertisers) and “Facebook Payments” (payment service for developers). On the other hand, the “Google Ads” service is a commercial suite acting as an umbrella for several pieces of software that all share the same contractual documents, and there is thus no need to separate each of them. See practical guidelines for [provider prefixing](declarations-guidelines.md#provider-prefixing).

In order to guide usage and disambiguate synonyms, we characterise each terms type along three dimensions of the commitment that is being taken in it:

1. The `writer` of the document;
2. the targeted `audience`;
3. the `object` of the commitment.

A terms type thus looks like:

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

Please note that we do not want [service-specific types](https://github.com/ambanum/OpenTermsArchive/pull/89) such as “Twitter Privacy Policy”. Terms types should be generic, even if only one service uses them at a given time. Otherwise, duplication occurs and [important efforts](https://github.com/ambanum/OpenTermsArchive/pull/88) have to be deployed to deduplicate. The triptych form “writer / audience / object” is precisely used to avoid this sort of duplication.

### Testing your declaration

You can test the declarations you created or changed by running the following command:

```
npm test [$service_id [$another_service_id …]]
```

Since this operation fetches documents and could be long, you can also validate the declaration structure only:

```
npm run test:schema [$service_id [$another_service_id …]]
```

#### Linting

In order to ensure consistency across declarations, all declarations files have to be formatted homogeneously.

In order to achieve this, you can use the following command:

```
npm run lint [$service_id [$another_service_id …]]
```

## Maintaining declarations

All parts of a **document** **declaration** (web location, selection, noise removal, single or multiple documents distribution…) can change over time. The process of updating these elements to enable continued **tracking** is called **maintenance**. Without it, **terms** can become:

- **unreachable**: no **snapshot** can be **recorded** at all, because the **location** changed or the **service** denies access;
- **unextractable**: no **version** can be **extracted** from the **snapshot**, because the selection of content or some **filter** fails;
- **noisy**: both **snapshots** and **versions** are **recorded** but the **changes** contain **noise** that should have been **filtered out**.

Open Terms Archive needs to keep track of this changes in order to regenerate versions history from snapshots history.

### Service history

To keep track of services declarations and filters changes, Open Terms Archive offers a versioning system. It is optional and should be added only when needed. It works by creating history files for terms declarations and filters, where each entry should be a previous valid declaration or filter function and should have an expiry date.

Both for terms and filters history, the expiration date is declared in a property `validUntil`. It should be the authored date and time of the last snapshot commit for which the declaration is still valid.

Terms declarations history files and filters history files can both evolve on their own. Having one does not imply to create the other.

The current (latest) valid declaration has no date and should not appear in the history object: it stays in its own file, just like if there was no history at all.

#### Terms declaration history

Declarations history are stored in a history JSON file with the following name `declarations/$service_id.history.json`.

The terms history contains an object with terms types as properties. Each terms type property is an array of history entries. Each entry has the same format as a normal terms declaration, except there is the **mandatory** extra property `validUntil`.

```json
{
  …
  "<terms type>": [
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

For example, to add a history entry for the `Terms of Service` of the service `ASKfm`, create the file `declarations/ASKfm.history.json` with the following contents:

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

Filters history is declared in a filters history declaration JavaScript file with the following name: `declarations/$service_id.filters.history.js`.

For each filter, a variable named like the filter must be exported. This variable should contain an array of filter history entries. Each entry is an object with the expiration date, as `validUntil` property, and the valid function for this date, under the `filter` property. Both properties are **mandatory**.

```js
export const <filterName> = [
  {
    validUntil: "The inclusive expiration date in ISO format",
    filter: function() { /* body valid until the expiration of the `validUntil` date */ }
  }
];
```

For example, to add a history entry for the `removeSharesButton` filter of the service `ASKfm`, create the file `declarations/ASKfm.filters.history.js` with the following content:

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
