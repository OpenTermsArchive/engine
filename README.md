# Open Terms Archive Engine

This repository contains the code and documentation of the engine of the [Open Terms Archive](https://opentermsarchive.org) project, which enables downloading, archiving and publishing versions of documents obtained online. It can be used independently from the Open Terms Archive ecosystem.

The document you are reading now is targeted at developers wanting to use or contribute to the engine. For a high-level overview of Open Terms Archive’s wider goals and processes, please read its [public homepage](https://opentermsarchive.org).

## Context

_Note: words in bold are [business domain names](https://en.wikipedia.org/wiki/Domain-driven_design)._

**Services** have **terms** written in **documents**, contractual (Terms of Services, Privacy Policy…) or not (Community Guidelines, Deceased User Policy…), that can change over time. Open Terms Archive enables users rights advocates, regulatory bodies and interested citizens to follow the **changes** to these **terms**, to be notified whenever a new **version** is published, to explore their entire **history** and to collaborate in analysing them. This free and open-source engine has been developed to that end.

## How it works

The document you are reading now is targeted at developers wanting to understand the technicalities and contribute to the project. For a high-level overview of the process, please look at the [public homepage](https://opentermsarchive.org).

### Vocabulary

#### Instances

Open Terms Archive is a decentralised system. It aims at enabling any entity to **track** **terms** on their own and at federating a number of public **instances** in a single ecosystem to maximise discoverability, collaboration and political power.

To that end, the Open Terms Archive **engine** is free and open-source software that can be deployed on any server, making it a dedicated **instance**.

> You can find existing federated public instances on [GitHub](
https://github.com/OpenTermsArchive?q=declarations).

#### Collections

An **instance** **tracks** **documents** of a single **collection**. A **collection** is characterised by a **scope** across **dimensions** such as **language**, **jurisdiction** and **industry**.

To distinguish between the different **terms** of a **service**, each **document** has a **type**, such as “Terms of Service”, “Privacy Policy”, “Developer Agreement”… These **types** match the topic, but not necessarily the title the **service** gives them. Unifying the **types** enables comparing **terms** across **services**.

> The terms types are made available in a [dedicated database](https://github.com/OpenTermsArchive/terms-types) and published on NPM under [`@opentermsarchive/terms-types`](https://www.npmjs.com/package/@opentermsarchive/terms-types), enabling standardisation and interoperability beyond the Open Terms Archive engine.

#### Declarations

The **documents** that constitute a **collection** are defined, along with some metadata on the **service** they relate to, in simple JSON files called **declarations**.

> Here is an example declaration tracking the Privacy Policy of the Open Terms Archive
>
> ```json
> {
>   "name": "Open Terms Archive",
>   "documents": {
>     "Privacy Policy": {
>       "fetch": "https://opentermsarchive.org/privacy-policy",
>       "select": ".TextContent_textContent__ToW2S"
>     }
>   }
> }
> ```

### Processes

#### Acquiring documents

Open Terms Archive **acquires** **documents** to deliver an explorable **history** of **changes**. This can be done in two ways:

1. For the present and future, by **tracking** **documents**.
2. For the past, by **importing** from an existing **fonds** such as [ToSBack](https://tosback.org), the [Internet Archive](https://archive.org/web/), [Common Crawl](https://commoncrawl.org) or any other in-house format.

#### Tracking documents

The **engine** **reads** these **declarations** to **record** a **snapshot** by **fetching** the declared web **location** periodically. The **engine** then **extracts** a **version** from this **snapshot** by:

1. **Selecting** the subset of the **snapshot** that contains the **terms** (instead of navigation menus, footers, cookies banners…).
2. **Removing** residual content in this subset that is not part of the **terms** (ads, illustrative pictures, internal navigation links…).
3. **Filtering noise** by preventing parts that change frequently from triggering false positives for **changes** (tracker identifiers in links, relative dates…). The **engine** can execute custom **filters** written in JavaScript to that end.

After these steps, if **changes** are spotted in the resulting **document**, a new **version** is **recorded**.

Preserving **snapshots** enables recovering after the fact information potentially lost in the **extraction** step: if **declarations** were wrong, they can be **maintained** and corrected **versions** can be **extracted** from the original **snapshots**.

#### Importing documents

Existing **fonds** can be prepared for easier analysis by unifying their format to the **Open Terms Archive dataset format**. This unique format enables building interoperable tools, fostering collaboration across reusers.
Such a dataset can be generated from **versions** alone. If **snapshots** and **declarations** can be retrieved from the **fonds** too, then a full-fledged **collection** can be created.

## Usage

There are different ways to use Open Terms Archive:

- Contributing to the engine
- Using as dependency
- Creating a new instance

## Contributing

To contribute to the core engine of Open Terms Archive, see the [CONTRIBUTING](CONTRIBUTING.md) file of this repository. You will need knowledge of JavaScript and NodeJS.

### Sponsorship and partnerships

Beyond individual contributions, we need funds and committed partners to pay for a core team to maintain and grow Open Terms Archive. If you know of opportunities, please let us know over email at `contact@[project name without spaces].org`!

- - -

## License

The code for this software is distributed under the [European Union Public Licence (EUPL) v1.2](https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12). In short, this [means](https://choosealicense.com/licenses/eupl-1.2/) you are allowed to read, use, modify and redistribute this source code, as long as you make it clear where it comes from and make available any change you make to it under similar conditions.

Contact the core team over email at `contact@[project name without spaces].org` if you have any specific need or question regarding licensing.
