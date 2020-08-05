# CGUs

**Services** have **terms** that can change over time. _CGUs_ enables users rights advocates, regulatory bodies and any interested citizen to follow the **changes** to these **terms** by being **notified** whenever a new **version** is published, and exploring their entire **history**.

> Les services ont des conditions générales qui évoluent dans le temps. _CGUs_ permet aux défenseurs des droits des utilisateurs, aux régulateurs et à toute personne intéressée de suivre les évolutions de ces conditions générales en étant notifiée à chaque publication d'une nouvelle version, et en explorant leur historique.


## How it works

_Note: Words in bold are [business domain names](https://en.wikipedia.org/wiki/Domain-driven_design)._

**Services** are **declared** within _CGUs_ with a **declaration file** listing all the **documents** that, together, constitute the **terms** under which this **service** can be used. These **documents** all have a **type**, such as “terms and conditions”, “privacy policy”, “developer agreement”…

In order to **track** their **changes**, **documents** are periodically obtained by **fetching** a web **location** and **selecting content** within the **web page** to remove the **noise** (ads, navigation menu, login fields…). Beyond selecting a subset of a page, some **documents** have additional **noise** (hashes in links, CSRF tokens…) that would be false positives for **changes**. _CGUs_ thus supports specific **filters** for each **document**.

However, the shape of that **noise** can change over time. In order to recover in case of information loss during the **noise filtering** step, a **snapshot** is **recorded** every time there is a **change**. After the **noise** is **filtered out** from the **snapshot**, if there are **changes** in the resulting **document**, a new **version** of the **document** is **recorded**.

Anyone can run their own **private** instance and track changes on their own. However, we also **publish** each **version** on a [**public** instance](https://github.com/ambanum/CGUs-versions) that makes it easy to explore the entire **history** and enables **notifying** over email whenever a new **version** is **recorded**.
Users can [**subscribe** to **notifications**](https://github.com/ambanum/CGUs-versions#be-notified).

_Note: For now, when multiple versions coexist, **terms** are only **tracked** in their English version and for the European jurisdiction._

## Description de l'outil

_Note: Les mots en gras sont les [termes du domaine](https://fr.wikipedia.org/wiki/Conception_pilot%C3%A9e_par_le_domaine)._

Les **services** sont **déclarés** dans l'outil _CGUs_ grâce à un **fichier de déclaration** listant les **documents** qui forment l'ensemble des **conditions** régissant l'usage du **service**. Ces **documents** peuvent être de plusieurs **types** : « conditions d'utilisation », « politique de confidentialité », « contrat de développeur »…

Afin de **suivre** leurs **évolutions**, les **documents** sont régulièrement mis à jour, en les **téléchargeant** depuis une **adresse** web et en **sélectionnant leur contenu** dans la **page web** pour supprimer le **bruit** (publicités, menus de navigation, champs de connexion…). En plus de simplement sélectionner une zone de la page, certains documents possèdent du **bruit** supplémentaire (hashs dans des liens, jetons CSRF...) créant de faux positifs en terme d'**évolutions**. En conséquence, _CGUs_ supporte des **filtres** spécifiques pour chaque **document**.

Néanmoins, le **bruit** peut changer de forme avec le temps. Afin d'éviter des pertes d'information irrécupérables pendant l'étape de **filtrage du bruit**, un **instantané** de la page Web est **enregistré** à chaque **évolution**. Après avoir **filtré l'instantané** de son **bruit**, si le **document** résultant a changé par rapport à sa **version** précédente, une nouvelle **version** est **enregistrée**.

Vous pouvez disposer de votre propre instance **privée** de l'outil _CGUs_ et suivre vous-même les **évolutions**. Néanmoins, nous **publions** chaque **version** sur une [instance **publique**](https://github.com/ambanum/CGUs-versions) facilitant l'exploration de l'**historique** et **notifiant** par courriels l'**enregistrement** de nouvelles **versions**. Les **utilisateurs** peuvent [**s'abonner** aux **notifications**](https://github.com/ambanum/CGUs-versions#recevoir-des-notifications).


_Note: Actuellement, nous privilégions les **conditions** rédigées en anglais et concernant la juridiction européenne._

## Installing

This module is built with [Node](https://nodejs.org/en/). You will need to [install Node](https://nodejs.org/en/download/) to run it.

Clone the repository and install dependencies:

```sh
git clone https://github.com/ambanum/CGUs.git
cd CGUs
npm install
```

## Setting up the database

Initialize the database:
```sh
npm run setup
```

## Configuration

The default configuration can be read and changed in `config/default.json`:

```json
{
  "serviceDeclarationsPath": "Directory containing services declarations and associated filters.",
  "history": {
    "dataPath": "Database directory path, relative to the root of this project",
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
      "errorTemplateId": "SendInBlue email template ID used for error notifications",
    }
  }
}
```

## Usage

To get the latest versions of all services' terms:

```
npm start
```

The latest version of a document will be available in `/data/sanitized/$service_provider_name/$document_type.md`.

To hourly update documents:

```
npm run start:scheduler
```

To get the latest version of a specific service's terms:

```
npm start $service_id
```

> The service id is the case sensitive name of the service declaration file without the extension. For example, for `Twitter.json`, the service id is `Twitter`.

## Contributing

### You want to add a new service?

See [CONTRIBUTING](CONTRIBUTING.md).

## Deploying

See [Ops Readme](ops/README.md).

- - -

## License

The code for this software is distributed under the European Union Public Licence (EUPL) v1.2.
Contact the author if you have any specific need or question regarding licensing.
