# How to explore a history of versions

Every public instance offers a public database of versions they recorded. For this guide, we will use the example of the Contrib instance. This instance publishes its history on the [contrib-versions](https://github.com/OpenTermsArchive/contrib-versions) repository.

From the **repository homepage** [contrib-versions](https://github.com/OpenTermsArchive/contrib-versions), open the folder of the **service of your choice** (e.g. [WhatsApp](https://github.com/OpenTermsArchive/contrib-versions/tree/main/WhatsApp)).

You will see the **set of documents tracked** for that service, now click **on the document of your choice** (e.g. [WhatsApp's Privacy Policy](https://github.com/OpenTermsArchive/contrib-versions/blob/main/WhatsApp/Privacy%20Policy.md)). The **latest version** (updated hourly) will be displayed.

To view the **history of changes** made to this document, click on **History** at the top right of the document (for our previous [example](https://github.com/OpenTermsArchive/contrib-versions/commits/main/WhatsApp/Privacy%20Policy.md)). The **changes** are ordered **by date**, with the latest first.

Click on a change to see what it consists of (for example [this one](https://github.com/OpenTermsArchive/contrib-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd)). There are **two types of display** you can choose from the icons in the gray bar above the document.

- The first one, named _source diff_ (button with chevrons) allows you to **display the old version and the new one side by side** (for our [example](https://github.com/OpenTermsArchive/contrib-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd#diff-e8bdae8692561f60aeac9d27a55e84fc)). This display has the merit of **explicitly showing** all additions and deletions.
- The second one, named _rich diff_ (button with a document icon) allows you to **unify all the changes in a single document** (for our [example](https://github.com/OpenTermsArchive/contrib-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd?short_path=e8bdae8#diff-e8bdae8692561f60aeac9d27a55e84fc)). The **red** color shows **deleted** elements, the **yellow** color shows **modified** paragraphs, and the **green** color shows **added** elements. Be careful, this display **does not show some changes** such as hyperlinks and text style's changes.

### Notes

- For long documents, unchanged **paragraphs will not be displayed by default**. You can manually make them appear by clicking on the small arrows just above or just below the displayed paragraphs.
- You can use the **History button anywhere** in the repository contrib-versions, which will then display the **history of changes made to all documents in the folder** where you are (including sub-folders).
