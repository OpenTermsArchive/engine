# Using Open Terms Archive as dependency

Open Terms Archive exposes a JavaScript API, to make some of its capabilities available in NodeJS, and a command line. You can install it as an NPM module:

```
npm install opentermsarchive
```

## CLI

The following commands are available where the package and can be used either using `npm exec` or `npx` command:

- `ota-lint-declarations`: check and normalise the format of declarations.
- `ota-validate-declarations`: validate declarations.
- `ota-track`: track services. Recorded snapshots and versions will be stored in the `data` folder at the root of the module where the package is installed.

In order to have them available globally in your command line, install it with the `--global` option.

## API

### `fetch`

The `fetch` module gets the MIME type and content of a document from its URL. You can use it in your code with `import fetch from 'open-terms-archive/fetch';`.

Documentation on how to use `fetch` is provided [as JSDoc](./src/archivist/fetcher/index.js).

#### `executeClientScripts`

If you pass the `executeClientScripts` option to `fetch`, a headless browser will be used to download and execute the page before serialising its DOM. For performance reasons, the starting and stopping of the browser is your responsibility to avoid instantiating a browser on each fetch. Here is an example on how to use this feature:

```js
import fetch, { launchHeadlessBrowser, stopHeadlessBrowser } from 'open-terms-archive/fetch';

await launchHeadlessBrowser();
await fetch({ executeClientScripts: true, ... });
await fetch({ executeClientScripts: true, ... });
await fetch({ executeClientScripts: true, ... });
await stopHeadlessBrowser();
```

The `fetch` module options are defined as a [`node-config` submodule](https://github.com/node-config/node-config/wiki/Sub-Module-Configuration). If [`node-config`](https://github.com/node-config/node-config) is used in the project, the default `fetcher` configuration can be overridden by adding a `fetcher` object to the [local configuration file](#configuration-file).

#### `filter`

The `filter` module transforms HTML or PDF content into a Markdown string according to a [document declaration](https://github.com/OpenTermsArchive/contrib-declarations/blob/main/CONTRIBUTING.md#declaring-a-new-service). You can use it in your code with `import filter from 'open-terms-archive/filter';`.

The `filter` function documentation is available [as JSDoc](./src/archivist/filter/index.js).

#### `PageDeclaration`

The `PageDeclaration` class encapsulates information about a page tracked by Open Terms Archive. You can use it in your code by using `import pageDeclaration from 'open-terms-archive/page-declaration';`.
