# CGUs

Les services en ligne ont des conditions générales qui évoluent dans le temps. _CGUs_ permet aux défenseurs des droits des utilisateurs, aux régulateurs et à toute personne intéressée de suivre les évolutions de ces conditions générales en étant notifiée à chaque publication d'une nouvelle version, et en explorant leur historique.


## Fonctionnement

_Note: Les mots en gras sont les [termes du domaine](https://fr.wikipedia.org/wiki/Conception_pilot%C3%A9e_par_le_domaine)._

Les **services** sont **déclarés** dans l'outil _CGUs_ grâce à un **fichier de déclaration** listant les **documents** qui forment l'ensemble des **conditions** régissant l'usage du **service**. Ces **documents** peuvent être de plusieurs **types** : « conditions d'utilisation », « politique de confidentialité », « contrat de développeur »…

Afin de **suivre** leurs **évolutions**, les **documents** sont régulièrement mis à jour, en les **téléchargeant** depuis une **adresse** web et en **sélectionnant leur contenu** dans la **page web** pour supprimer le **bruit** (publicités, menus de navigation, champs de connexion…). En plus de simplement sélectionner une zone de la page, certains documents possèdent du **bruit** supplémentaire (hashs dans des liens, jetons CSRF...) créant de faux positifs en terme d'**évolutions**. En conséquence, _CGUs_ supporte des **filtres** spécifiques pour chaque **document**.

Néanmoins, le **bruit** peut changer de forme avec le temps. Afin d'éviter des pertes d'information irrécupérables pendant l'étape de **filtrage du bruit**, un **instantané** de la page Web est **enregistré** à chaque **évolution**. Après avoir **filtré l'instantané** de son **bruit**, si le **document** résultant a changé par rapport à sa **version** précédente, une nouvelle **version** est **enregistrée**.

Vous pouvez disposer de votre propre instance **privée** de l'outil _CGUs_ et suivre vous-même les **évolutions**. Néanmoins, nous **publions** chaque **version** sur une [instance **publique**](https://github.com/ambanum/CGUs-versions) facilitant l'exploration de l'**historique** et **notifiant** par courriels l'**enregistrement** de nouvelles **versions**. Les **utilisateurs** peuvent [**s'abonner** aux **notifications**](#recevoir-des-notifications).

_Note: Actuellement, nous ne suivons que les **conditions** rédigées en anglais et concernant la juridiction européenne._


## Naviguer dans l'historique des versions

À partir de la **page d'accueil du dépôt** [CGUs-versions](https://github.com/ambanum/CGUs-versions), ouvrez le dossier du **service de votre choix** (prenons par exemple [WhatsApp](https://github.com/ambanum/CGUs-versions/tree/master/WhatsApp)).

L'**ensemble des documents suivis** pour ce service s'affichent, cliquez ensuite sur **celui dont vous souhaitez suivre l'historique** (par exemple la [politique d'utilisation des données de WhatsApp](https://github.com/ambanum/CGUs-versions/blob/master/WhatsApp/privacy_policy.md)). Le document s'affiche alors dans sa **dernière version** (il est actualisé toutes les heures).

Pour afficher l'**historique des modifications** subies par ce document, cliquez sur **History** en haut à droite du document (pour l'exemple précédent nous arrivons [ici](https://github.com/ambanum/CGUs-versions/commits/master/WhatsApp/privacy_policy.md)). Les **modifications** sont affichées **par dates**, de la plus récente à la plus ancienne.

Cliquez sur une modification pour voir en quoi elle consiste (par exemple [celle-ci](https://github.com/ambanum/CGUs-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd)). Vous disposez de **deux types d'affichage**, sélectionnables à partir des icônes dans la barre grisée qui chapeaute le document.

- Le premier, appelé *source diff* (bouton avec des chevrons) permet d'**afficher côte-à-côte l'ancienne version et la nouvelle** (pour notre [exemple](https://github.com/ambanum/CGUs-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd#diff-e8bdae8692561f60aeac9d27a55e84fc)). Cet affichage a le mérite de **montrer explicitement** l'ensemble des ajouts/suppressions.
- Le second, appelé *rich diff* (bouton avec l'icône document) permet d'**unifier l'ensemble des modifications sur un seul document** (pour notre [exemple](https://github.com/ambanum/CGUs-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd?short_path=e8bdae8#diff-e8bdae8692561f60aeac9d27a55e84fc)). La couleur **rouge** montre les éléments **supprimés**, la couleur **jaune** montre les paragraphes **modifiés**, et la couleur **verte** montrent les éléments **ajoutés**. Attention, cet affichage **ne montre pas certaines modifications** comme le changement des hyperliens et le style du texte.

### Remarques

- Pour les longs documents, les **paragraphes inchangés ne seront pas affichés par défaut**. Vous pouvez manuellement les faire apparaître en cliquant sur les petites flèches juste au-dessus ou juste en-dessous des paragraphes affichés.
- Vous pouvez utiliser le bouton **History n'importe où** dans le dépôt CGUs-versions, qui affichera alors l'**historique des modifications subies par tous les documents se trouvant dans le dossier** où vous vous trouvez (y compris dans les sous-dossiers).


## Recevoir des notifications

Vous pouvez vous abonner pour recevoir un courriel lorsqu'un document est modifié en [remplissant ce formulaire](https://59692a77.sibforms.com/serve/MUIEAKuTv3y67e27PkjAiw7UkHCn0qVrcD188cQb-ofHVBGpvdUWQ6EraZ5AIb6vJqz3L8LDvYhEzPb2SE6eGWP35zXrpwEFVJCpGuER9DKPBUrifKScpF_ENMqwE_OiOZ3FdCV2ra-TXQNxB2sTEL13Zj8HU7U0vbbeF7TnbFiW8gGbcOa5liqmMvw_rghnEB2htMQRCk6A3eyj).

**Attention, ce service est en version bêta et vous risquez de recevoir de nombreuses notifications !** Vous pourrez vous désabonner en répondant à n'importe quel courriel reçu.

Il est également possible d'être notifié pour le suivi d'un service et/ou un document spécifique en s'abonnant à un des flux RSS disponibles.

_Un flux RSS est une ressource accessible en ligne qui contient des informations sur les derniers contenus publiés par un site web comme par exemple leur date de publication et l'adresse pour les consulter.
Lorsque cette ressource est mise à jour, votre lecteur de flux vous notifie automatiquement et vous pouvez ainsi consulter la mise à jour._

### Flux RSS disponibles

| Est mis à jour pour | URL |
|--|--|
| l'ensemble des services et documents | `https://github.com/ambanum/CGUs-versions/commits.atom` |
|l'ensemble des documents d'un service| `https://github.com/ambanum/CGUs-versions/commits/master/$serviceId.atom.` Remplacer __$serviceId__ par l'identifiant du service. |
| un document spécifique d'un service | `https://github.com/ambanum/CGUs-versions/commits/master/$serviceId/$documentType.md.atom` Remplacer __$serviceId__ par l'identifiant du service et __$documentType__ par le type du document |

Par exemple :
- Pour recevoir toutes les mises à jour des documents de `Facebook`, l'URL est `https://github.com/ambanum/CGUs-versions/commits/master/Facebook.atom`

- Pour recevoir toutes les mises à jour des `Privacy Policy` de `Google`, l'URL est `https://github.com/ambanum/CGUs-versions/commits/master/Google/Privacy Policy.md.atom`

#### Recevoir les mise à jour de flux RSS par courriel

Il est possible de recevoir les mises à jour de flux RSS par courriel en utilisant un service externe comme [feedrabbit](https://feedrabbit.com/).

#### Exemples de lecteurs de flux RSS
- Sur OS X : [Reeder](https://reederapp.com/)
- Sur Linux : [Akregator](https://kde.org/applications/en/akregator) ou [FeedReader](https://jangernert.github.io/FeedReader/)
- Sur Windows : [Omea](https://www.jetbrains.com/omea/reader/)
- Web et applications mobile : [Inoreader](https://www.inoreader.com/) ou [Feedly](https://feedly.com/)

## Contribuer

### Ajouter un nouveau service

Voir le fichier [CONTRIBUTING](CONTRIBUTING.md) (en anglais).
