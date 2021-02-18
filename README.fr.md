# Open Terms Archive

Les services en ligne ont des conditions générales qui évoluent dans le temps. _Open Terms Archive_ permet aux défenseurs des droits des utilisateurs, aux régulateurs et à toute personne intéressée de suivre les évolutions de ces conditions générales en étant notifiée à chaque publication d'une nouvelle version, et en explorant leur historique.

## Table des matières

* [Fonctionnement](#fonctionnement)
* [Naviguer dans l'historique des versions](#naviguer-dans-lhistorique-des-versions)
  * [Remarques](#remarques)
* [Recevoir des notifications](#recevoir-des-notifications)
  * [Par courriel](#par-courriel)
    * [Recevoir les mises à jour de services ou documents spécifiques](#recevoir-les-mises-%C3%A0-jour-de-services-ou-documents-sp%C3%A9cifiques)
  * [Par RSS](#par-rss)
    * [Récapitulatif des flux RSS disponibles](#r%C3%A9capitulatif-des-flux-rss-disponibles)
* [Contribuer](#contribuer)
  * [Ajouter un nouveau service](#ajouter-un-nouveau-service)

## Fonctionnement

_Note: Les mots en gras sont les [termes du domaine](https://fr.wikipedia.org/wiki/Conception_pilot%C3%A9e_par_le_domaine)._

Les **services** sont **déclarés** dans l'outil _Open Terms Archive_ grâce à un **fichier de déclaration** listant les **documents** qui forment l'ensemble des **conditions** régissant l'usage du **service**. Ces **documents** peuvent être de plusieurs **types** : « conditions d'utilisation », « politique de confidentialité », « contrat de développeur »…

Afin de **suivre** leurs **évolutions**, les **documents** sont régulièrement mis à jour, en les **téléchargeant** depuis une **adresse** web et en **sélectionnant leur contenu** dans la **page web** pour supprimer le **bruit** (publicités, menus de navigation, champs de connexion…). En plus de simplement sélectionner une zone de la page, certains documents possèdent du **bruit** supplémentaire (hashs dans des liens, jetons CSRF...) créant de faux positifs en terme d'**évolutions**. En conséquence, _Open Terms Archive_ supporte des **filtres** spécifiques pour chaque **document**.

Néanmoins, le **bruit** peut changer de forme avec le temps. Afin d'éviter des pertes d'information irrécupérables pendant l'étape de **filtrage du bruit**, un **instantané** de la page Web est **enregistré** à chaque **évolution**. Après avoir **filtré l'instantané** de son **bruit**, si le **document** résultant a changé par rapport à sa **version** précédente, une nouvelle **version** est **enregistrée**.

Vous pouvez disposer de votre propre instance **privée** de l'outil _Open Terms Archive_ et suivre vous-même les **évolutions**. Néanmoins, nous **publions** chaque **version** sur une [instance **publique**](https://github.com/ambanum/Open Terms Archive-versions) facilitant l'exploration de l'**historique** et **notifiant** par courriels l'**enregistrement** de nouvelles **versions**. Les **utilisateurs** peuvent [**s'abonner** aux **notifications**](#recevoir-des-notifications).

_Note: Actuellement, nous ne suivons que les **conditions** rédigées en anglais et concernant la juridiction européenne._


## Naviguer dans l'historique des versions

À partir de la **page d'accueil du dépôt** [Open Terms Archive-versions](https://github.com/ambanum/Open Terms Archive-versions), ouvrez le dossier du **service de votre choix** (prenons par exemple [WhatsApp](https://github.com/ambanum/Open Terms Archive-versions/tree/master/WhatsApp)).

L'**ensemble des documents suivis** pour ce service s'affichent, cliquez ensuite sur **celui dont vous souhaitez suivre l'historique** (par exemple la [politique d'utilisation des données de WhatsApp](https://github.com/ambanum/Open Terms Archive-versions/blob/master/WhatsApp/Privacy%20Policy.md)). Le document s'affiche alors dans sa **dernière version** (il est actualisé toutes les heures).

Pour afficher l'**historique des modifications** subies par ce document, cliquez sur **History** en haut à droite du document (pour l'exemple précédent nous arrivons [ici](https://github.com/ambanum/Open Terms Archive-versions/commits/master/WhatsApp/Privacy%20Policy.md)). Les **modifications** sont affichées **par dates**, de la plus récente à la plus ancienne.

Cliquez sur une modification pour voir en quoi elle consiste (par exemple [celle-ci](https://github.com/ambanum/Open Terms Archive-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd)). Vous disposez de **deux types d'affichage**, sélectionnables à partir des icônes dans la barre grisée qui chapeaute le document.

- Le premier, appelé *source diff* (bouton avec des chevrons) permet d'**afficher côte-à-côte l'ancienne version et la nouvelle** (pour notre [exemple](https://github.com/ambanum/Open Terms Archive-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd#diff-e8bdae8692561f60aeac9d27a55e84fc)). Cet affichage a le mérite de **montrer explicitement** l'ensemble des ajouts/suppressions.
- Le second, appelé *rich diff* (bouton avec l'icône document) permet d'**unifier l'ensemble des modifications sur un seul document** (pour notre [exemple](https://github.com/ambanum/Open Terms Archive-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd?short_path=e8bdae8#diff-e8bdae8692561f60aeac9d27a55e84fc)). La couleur **rouge** montre les éléments **supprimés**, la couleur **jaune** montre les paragraphes **modifiés**, et la couleur **verte** montrent les éléments **ajoutés**. Attention, cet affichage **ne montre pas certaines modifications** comme le changement des hyperliens et le style du texte.

### Remarques

- Pour les longs documents, les **paragraphes inchangés ne seront pas affichés par défaut**. Vous pouvez manuellement les faire apparaître en cliquant sur les petites flèches juste au-dessus ou juste en-dessous des paragraphes affichés.
- Vous pouvez utiliser le bouton **History n'importe où** dans le dépôt Open Terms Archive-versions, qui affichera alors l'**historique des modifications subies par tous les documents se trouvant dans le dossier** où vous vous trouvez (y compris dans les sous-dossiers).


## Recevoir des notifications

### Par courriel

Vous pouvez [vous abonner](https://59692a77.sibforms.com/serve/MUIEAKuTv3y67e27PkjAiw7UkHCn0qVrcD188cQb-ofHVBGpvdUWQ6EraZ5AIb6vJqz3L8LDvYhEzPb2SE6eGWP35zXrpwEFVJCpGuER9DKPBUrifKScpF_ENMqwE_OiOZ3FdCV2ra-TXQNxB2sTEL13Zj8HU7U0vbbeF7TnbFiW8gGbcOa5liqmMvw_rghnEB2htMQRCk6A3eyj) pour recevoir un courriel à chaque modification d'un document dans l'ensemble de la base.

**Attention, ce service est en version bêta et vous risquez de recevoir de nombreuses notifications !** Vous pourrez vous désabonner en répondant à n'importe quel courriel reçu.

#### Recevoir les mises à jour de services ou documents spécifiques

Pour recevoir les mises à jour de services ou documents spécifiques par courriel, vous pouvez utiliser les instructions de notification [par RSS](#par-rss) et mettre en place un service tiers comme [FeedRabbit](https://feedrabbit.com/) pour vous envoyer un courriel à chaque changement.

### Par RSS

Vous pouvez recevoir une notification pour un service ou un document spécifique en vous abonnant à des flux RSS.

> Un flux RSS est un type de page accessible en ligne qui contient des informations sur les derniers contenus publiés par un site web comme leur date de publication et l'adresse pour les consulter. Lorsque cette ressource est mise à jour, une application de type lecteur de flux vous notifie automatiquement et vous pouvez ainsi consulter la mise à jour.

Pour obtenir l'adresse du flux RSS auquel vous abonner :

1. [Naviguez](#naviguer-dans-lhistorique-des-versions) jusqu’à la page qui présente l’historique des modifications qui vous intéressent. _Dans l'exemple de WhatsApp donné plus haut, il s’agit de [cette page](https://github.com/ambanum/Open Terms Archive-versions/commits/master/WhatsApp/Privacy%20Policy.md)._
2. Copiez l’adresse de cette page depuis la barre d’adresse de votre navigateur. _Dans l’exemple de WhatsApp, il s’agit de `https://github.com/ambanum/Open Terms Archive-versions/commits/master/WhatsApp/Privacy%20Policy.md`._
3. Ajoutez `.atom` à la fin de cette adresse. _Dans l’exemple de WhatsApp, cela donnerait `https://github.com/ambanum/Open Terms Archive-versions/commits/master/WhatsApp/Privacy%20Policy.md.atom`._
4. Abonnez votre lecteur de flux RSS à l’adresse résultante.

#### Récapitulatif des flux RSS disponibles

| Mis à jour pour | URL |
|-----------------|-----|
| l'ensemble des services et documents | `https://github.com/ambanum/Open Terms Archive-versions/commits.atom` |
| l'ensemble des documents d'un service | Remplacer `$serviceId` par l'identifiant du service :<br>`https://github.com/ambanum/Open Terms Archive-versions/commits/master/$serviceId.atom` |
| un document spécifique d'un service | Remplacer `$serviceId` par l'identifiant du service et `$documentType` par le type du document :<br>`https://github.com/ambanum/Open Terms Archive-versions/commits/master/$serviceId/$documentType.md.atom` |

Par exemple :

- Pour recevoir toutes les mises à jour des documents de `Facebook`, abonnez-vous à `https://github.com/ambanum/Open Terms Archive-versions/commits/master/Facebook.atom`.
- Pour recevoir toutes les mises à jour des `Privacy Policy` de `Google`, abonnez-vous à `https://github.com/ambanum/Open Terms Archive-versions/commits/master/Google/Privacy%20Policy.md.atom`.


## Contribuer

### Ajouter un nouveau service

Voir le fichier [CONTRIBUTING](CONTRIBUTING.md) (en anglais).
