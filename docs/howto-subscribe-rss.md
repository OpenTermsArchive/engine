### By RSS

You can receive notification for a specific service or document by subscribing to RSS feeds.

> An RSS feed is a type of web page that contains information about the latest content published by a website, such as the date of publication and the address where you can view it. When this resource is updated, a feed reader app automatically notifies you and you can see the update.

To find out the address of the RSS feed you want to subscribe to:

1. [Navigate](#exploring-the-versions-history) to the page with the history of changes you are interested in. _In the WhatsApp example above, this would be [this page](https://github.com/OpenTermsArchive/contrib-versions/commits/main/WhatsApp/Privacy%20Policy.md)._
2. Copy the address of that page from your browser’s address bar. _In the WhatsApp example, this would be `https://github.com/OpenTermsArchive/contrib-versions/commits/main/WhatsApp/Privacy%20Policy.md`._
3. Append `.atom` at the end of this address. _In the WhatsApp example, this would become `https://github.com/OpenTermsArchive/contrib-versions/commits/main/WhatsApp/Privacy%20Policy.md.atom`._
4. Subscribe your RSS feed reader to the resulting address.

#### Recap of available RSS feeds

| Updated for                         | URL                                                                                                                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| all services and documents          | `https://github.com/OpenTermsArchive/contrib-versions/commits.atom`                                                                                                                            |
| all the documents of a service      | Replace `$serviceId` with the service ID:<br>`https://github.com/OpenTermsArchive/contrib-versions/commits/main/$serviceId.atom.`                                                            |
| a specific document of a service | Replace `$serviceId` with the service ID and `$documentType` with the document type:<br>`https://github.com/OpenTermsArchive/contrib-versions/commits/main/$serviceId/$documentType.md.atom` |

For example:

- To receive all updates of `Facebook` documents, the URL is `https://github.com/OpenTermsArchive/contrib-versions/commits/main/Facebook.atom`.
- To receive all updates of the `Privacy Policy` from `Google`, the URL is `https://github.com/OpenTermsArchive/contrib-versions/commits/main/Google/Privacy%20Policy.md.atom`.
