# CGUs

**Services** have **terms** that can change over time. _CGUs_ enables users rights advocates, regulatory bodies and any interested citizen to follow the **changes** to these **terms** by being **notified** whenever a new **version** is published, and exploring their entire **history**.

> Les services ont des conditions générales qui évoluent dans le temps. _CGUs_ permet aux défenseurs des droits des utilisateurs, aux régulateurs et à toute personne intéressée de suivre les évolutions de ces conditions générales en étant notifiée à chaque publication d'une nouvelle version, et en explorant leur historique.

[🇫🇷 Manuel en français](README.fr.md).


## How it works

_Note: Words in bold are [business domain names](https://en.wikipedia.org/wiki/Domain-driven_design)._

**Services** are **declared** within _CGUs_ with a **declaration file** listing all the **documents** that, together, constitute the **terms** under which this **service** can be used. These **documents** all have a **type**, such as “terms and conditions”, “privacy policy”, “developer agreement”…

In order to **track** their **changes**, **documents** are periodically obtained by **fetching** a web **location** and **selecting content** within the **web page** to remove the **noise** (ads, navigation menu, login fields…). Beyond selecting a subset of a page, some **documents** have additional **noise** (hashes in links, CSRF tokens…) that would be false positives for **changes**. _CGUs_ thus supports specific **filters** for each **document**.

However, the shape of that **noise** can change over time. In order to recover in case of information loss during the **noise filtering** step, a **snapshot** is **recorded** every time there is a **change**. After the **noise** is **filtered out** from the **snapshot**, if there are **changes** in the resulting **document**, a new **version** of the **document** is **recorded**.

Anyone can run their own **private** instance and track changes on their own. However, we also **publish** each **version** on a [**public** instance](https://github.com/ambanum/CGUs-versions) that makes it easy to explore the entire **history** and enables **notifying** over email whenever a new **version** is **recorded**.
Users can [**subscribe** to **notifications**](#be-notified).

_Note: For now, when multiple versions coexist, **terms** are only **tracked** in their English version and for the European jurisdiction._


## Exploring the versions history

We offer a public database of versions recorded each time there is a change in the terms of service and other contractual documents of tracked services: [CGUs-Versions](https://github.com/ambanum/CGUs-versions).

From the **repository homepage** [CGUs-versions](https://github.com/ambanum/CGUs-versions), open the folder of the **service of your choice** (e.g. [WhatsApp](https://github.com/ambanum/CGUs-versions/tree/master/WhatsApp)).

You will see the **set of documents tracked** for that service, now click **on the document of your choice** (e.g. [WhatsApp's Privacy Policy](https://github.com/ambanum/CGUs-versions/blob/master/WhatsApp/Privacy%20Policy.md)). The **latest version** (updated hourly) will be displayed.

To view the **history of changes** made to this document, click on **History** at the top right of the document (for our previous [example](https://github.com/ambanum/CGUs-versions/commits/master/WhatsApp/Privacy%20Policy.md)). The **changes** are ordered **by date**, with the latest first.

Click on a change to see what it consists of (for example [this one](https://github.com/ambanum/CGUs-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd)). There are **two types of display** you can choose from the icons in the gray bar above the document.

- The first one, named *source diff* (button with chevrons) allows you to **display the old version and the new one side by side** (for our [example](https://github.com/ambanum/CGUs-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd#diff-e8bdae8692561f60aeac9d27a55e84fc)). This display has the merit of **explicitly showing** all additions and deletions.
- The second one, named *rich diff* (button with a document icon) allows you to **unify all the changes in a single document** (for our [example](https://github.com/ambanum/CGUs-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd?short_path=e8bdae8#diff-e8bdae8692561f60aeac9d27a55e84fc)). The **red** color shows **deleted** elements, the **yellow** color shows **modified** paragraphs, and the **green** color shows **added** elements. Be careful, this display **does not show some changes** such as hyperlinks and text style's changes.

### Notes

- For long documents, unchanged **paragraphs will not be displayed by default**. You can manually make them appear by clicking on the small arrows just above or just below the displayed paragraphs.
- You can use the **History button anywhere** in the repository CGUs-versions, which will then display the **history of changes made to all documents in the folder** where you are (including sub-folders).

## Be notified

You can subscribe to receive an email when a document is updated by [filling the form available here](https://59692a77.sibforms.com/serve/MUIEAKuTv3y67e27PkjAiw7UkHCn0qVrcD188cQb-ofHVBGpvdUWQ6EraZ5AIb6vJqz3L8LDvYhEzPb2SE6eGWP35zXrpwEFVJCpGuER9DKPBUrifKScpF_ENMqwE_OiOZ3FdCV2ra-TXQNxB2sTEL13Zj8HU7U0vbbeF7TnbFiW8gGbcOa5liqmMvw_rghnEB2htMQRCk6A3eyj).

**Beware, this is an early beta and you are likely to receive a large amount of notifications!** You can unsubscribe by replying to any email you will get.

It is also possible to be notified for tan update of a service and/or a specific document by subscribing to one of the available RSS feeds.

_An RSS feed is an online resource that contains information about the latest content published by a website, such as the date of publication and the address to view it.
When this resource is updated, your feed reader automatically notifies you and you can view the update._

### RSS feeds available

| Is updated for | URL |
|--|--|
| all services and documents | `https://github.com/ambanum/CGUs-versions/commits.atom` |
| all the documents of a service | Replace __$serviceId__ with the service ID:<br>`https://github.com/ambanum/CGUs-versions/commits/master/$serviceId.atom.` |
| un document spécifique d'un service | Replace __$serviceId__ with the service ID and __$documentType__ with the document type:<br>`https://github.com/ambanum/CGUs-versions/commits/master/$serviceId/$documentType.md.atom` |

For example:
- To receive all updates of `Facebook` documents, the URL is `https://github.com/ambanum/CGUs-versions/commits/master/Facebook.atom`

- To receive all updates of the `Privacy Policy` from `Google`, the URL is `https://github.com/ambanum/CGUs-versions/commits/master/Google/Privacy Policy.md.atom`

#### Receive RSS feed updates by email

It is possible to receive RSS feed updates by email using an external service such as [feedrabbit](https://feedrabbit.com/).

#### Examples of RSS feed readers
- On OS X: [Reeder](https://reederapp.com/)
- On Linux: [Akregator](https://kde.org/applications/en/akregator) or [FeedReader](https://jangernert.github.io/FeedReader/)
- On Windows: [Omea](https://www.jetbrains.com/omea/reader/)
- Web et mobile applications: [Inoreader](https://www.inoreader.com/) or [Feedly](https://feedly.com/)


## Analysing the snapshots history

We provide a database of snapshots recorded each time there is a change in the terms of service and other contractual documents of tracked services: [CGUs-Snapshots](https://github.com/ambanum/CGUs-snapshots).


## Contributing

### Adding a new service

See [CONTRIBUTING](CONTRIBUTING.md).


## Using locally

### Installing

This module is built with [Node](https://nodejs.org/en/). You will need to [install Node](https://nodejs.org/en/download/) to run it.

Clone the repository and install dependencies:

```sh
git clone https://github.com/ambanum/CGUs.git
cd CGUs
npm install
```

### Setting up the database

Initialize the database:
```sh
npm run setup
```

### Configuring

#### Configuration file

The default configuration can be read and changed in `config/default.json`:

```json
{
  "serviceDeclarationsPath": "Directory containing services declarations and associated filters.",
  "history": {
    "snapshotsPath": "Snapshots database directory path, relative to the root of this project",
    "versionsPath": "Versions database directory path, relative to the root of this project",
    "publish": "Boolean. Set to true to publish changes to the shared, global database. Should be true only in production.",
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
      "updateErrorTemplateId": "SendInBlue email template ID used for updates error notifications",
      "applicationErrorTemplateId": "SendInBlue email template ID used for application error notifications"
    }
  }
}
```

An example of a production configuration file can be found in `config/production.json`. It includes the extra configuration for:

* A logging mechanism, to be notified upon error (this requires a valid SMTP configuration, see [environment variables](#environment-variables) below):

```json
{
  "logger": {
    "sendMailOnError": {
      "to": "recipient@example.com",
      "from": "cgu-bot@example.com"
    }
  }
}
```

* Public URLs to the snapshots and versions repositories, used to automate the initial database setup (`publicSnapshotsRepository` and `publicVersionsRepository` which are used by `npm setup`) and for the links in notifications (`snapshotsBaseUrl`):

```json
{
  "history": {
    "publicSnapshotsRepository": "https://github.com/ambanum/CGUs-snapshots.git",
    "publicVersionsRepository": "https://github.com/ambanum/CGUs-versions.git",
    "snapshotsBaseUrl": "https://github.com/ambanum/CGUs-snapshots/commit/"
  }
}
```

#### Environment variables

These environment variables can be provided in a `.env` file at the root of the repository. See `.env.example` for an example of such a file.

In order to be notified for errors, a valid SMTP configuration should be provided through the following environment variables:

* `SMTP_HOST` for the SMTP hostname
* `SMTP_USERNAME` / `SMTP_PASSWORD` for the credentials


If your infrastructure requires using an outgoing HTTP/HTTPS proxy to access Internet, you can provide it through the `HTTP_PROXY` and `HTTPS_PROXY` environment variable.

In order to use the default [SendInBlue](https://www.sendinblue.com)-based notification mechanism, a valid API key should be provided through the `SENDINBLUE_API_KEY` environment variable.


### Running

To get the latest versions of all services' terms:

```
npm start
```

The latest version of a document will be available in `/data/versions/$service_provider_name/$document_type.md`.

To hourly update documents:

```
npm run start:scheduler
```

To get the latest version of a specific service's terms:

```
npm start $service_id
```

> The service id is the case sensitive name of the service declaration file without the extension. For example, for `Twitter.json`, the service id is `Twitter`.

### Deploying

See [Ops Readme](ops/README.md).

- - -

## License

The code for this software is distributed under the European Union Public Licence (EUPL) v1.2.
Contact the author if you have any specific need or question regarding licensing.
