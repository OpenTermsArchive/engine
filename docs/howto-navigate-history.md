# How to explore a history of versions

Every public instance offers a public database of versions they recorded. For this guide, we will use the example of the Contrib instance. This instance publishes its history on the [`OpenTermsArchive/contrib-versions`](https://github.com/OpenTermsArchive/contrib-versions) repository.

From the [repository page](https://github.com/OpenTermsArchive/contrib-versions), open the folder of the service of your choice. For example, [WhatsApp](https://github.com/OpenTermsArchive/contrib-versions/tree/main/WhatsApp).

You will see the set of documents tracked for that service, now click on the document of your choice. For example, [WhatsApp's Privacy Policy](https://github.com/OpenTermsArchive/contrib-versions/blob/main/WhatsApp/Privacy%20Policy.md). The latest version will be displayed.

To view the history of changes made to this document, click on History at the top right of the document. The changes are ordered ante-chronologically. For example, [WhatsApp’s Privacy Policy history](https://github.com/OpenTermsArchive/contrib-versions/commits/main/WhatsApp/Privacy%20Policy.md).

Click on a change to see its contents. The red colour shows deleted elements and the green colour shows added elements. For example, here is an entry for [WhatsApp’s Privacy Policy](https://github.com/OpenTermsArchive/contrib-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd).

You can choose from two types of display with the icons in the grey bar above the document:

- The first one, named _source diff_ (button with chevrons) displays the previous version and the next one [side by side](https://github.com/OpenTermsArchive/contrib-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd#diff-e8bdae8692561f60aeac9d27a55e84fc).
- The second one, named _rich diff_ (button with a document icon) displays all the changes [in a single document](https://github.com/OpenTermsArchive/contrib-versions/commit/58a1d2ae4187a3260ac58f3f3c7dcd3aeacaebcd?short_path=e8bdae8#diff-e8bdae8692561f60aeac9d27a55e84fc). In this view, beyond green and red, the yellow color shows modified paragraphs. Be careful, this display does not show some changes such as hyperlinks and text style's changes.

## Notes

- For long documents, unchanged paragraphs will not be displayed by default. You can manually make them appear by clicking on the small arrows just above or just below the displayed paragraphs.
- You can use the History button anywhere in the repository to display the history of changes made to all documents in the current folder (including sub-folders).
