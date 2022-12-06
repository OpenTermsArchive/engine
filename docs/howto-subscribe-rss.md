# Subscribe by RSS

An RSS feed is a type of web page that contains information about the latest content published by a website, such as the date of publication and the address where you can view it. When this resource is updated, a feed reader app automatically notifies you and you can see the update. You can receive notification for a specific service or document by subscribing to RSS feeds.

## For a specific document

To find out the address of the RSS feed you want to subscribe to:

1. [Navigate](#exploring-the-versions-history) to the page with the history of changes you are interested in.
	- For example, for the WhatsApp Privacy Policy of the Contrib instance, this would be [this page](https://github.com/OpenTermsArchive/contrib-versions/commits/main/WhatsApp/Privacy%20Policy.md).
2. Copy the address of that page from your browser’s address bar.
	- For example, for the WhatsApp Privacy Policy of the Contrib instance, this would be `https://github.com/OpenTermsArchive/contrib-versions/commits/main/WhatsApp/Privacy%20Policy.md`.
3. Append `.atom` at the end of this address.
	- For example, for the WhatsApp Privacy Policy of the Contrib instance, this would become `https://github.com/OpenTermsArchive/contrib-versions/commits/main/WhatsApp/Privacy%20Policy.md.atom`.
4. Subscribe your RSS feed reader to the resulting address.

## For all the documents of a service

Simply navigate to the history of changes for the service you are interested in and follow the same procedure as for a specific document.

For example, for all WhatsApp documents of the Contrib instance, you would obtain `https://github.com/OpenTermsArchive/contrib-versions/commits/main/WhatsApp.atom`.

## For all the documents of an instance

Simply append `commits.atom` to the URL of the repository.

For example, for all documents of the Contrib instance, you would use `https://github.com/OpenTermsArchive/contrib-versions/commits.atom`.
