import config from 'config';

const LOCALE = 'en-EN';
const DATE_OPTIONS = { year: 'numeric', month: 'long', day: 'numeric' };

export default function readme({ releaseDate, servicesCount, firstVersionDate, lastVersionDate }) {
  return `# Open Terms Archive — ${title({ releaseDate })}

${body({ servicesCount, firstVersionDate, lastVersionDate })}`;
}

export function title({ releaseDate }) {
  releaseDate = releaseDate.toLocaleDateString(LOCALE, DATE_OPTIONS);

  const title = config.get('dataset.title');

  return `${title} — ${releaseDate} dataset`;
}

export function body({ servicesCount, firstVersionDate, lastVersionDate }) {
  firstVersionDate = firstVersionDate.toLocaleDateString(LOCALE, DATE_OPTIONS);
  lastVersionDate = lastVersionDate.toLocaleDateString(LOCALE, DATE_OPTIONS);

  const versionsRepositoryURL = config.get('dataset.versionsRepositoryURL');

  return `This dataset consolidates the contractual documents of ${servicesCount} service providers, in all their versions that were accessible online between ${firstVersionDate} and ${lastVersionDate}.

This dataset is tailored for datascientists and other analysts. You can also explore all these versions interactively on [${versionsRepositoryURL}](${versionsRepositoryURL}).

It has been generated with [Open Terms Archive](https://opentermsarchive.org).

### Dataset format

This dataset represents each version of a document as a separate [Markdown](https://spec.commonmark.org/0.30/) file. These files are:

- named after the date and time at which they were recorded, in the [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) format, always in UTC;
- in a directory named after the [document type](https://github.com/ambanum/OpenTermsArchive/blob/main/src/archivist/services/documentTypes.json);
- in a directory named after the service provider.

The filesystem layout will look like below.

\`\`\`
├ README.md
├┬ Service provider 1 (e.g. Facebook)
│├┬ Document type 1 (e.g. Terms of Service)
││├ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-08-01T01-03-12Z.md)
┆┆┆
││└ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-10-03T08-12-25Z.md)
┆┆
│└┬ Document type X (e.g. Privacy Policy)
│ ├ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-05-02T03-02-15Z.md)
┆ ┆
│ └ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-11-14T12-36-45Z.md)
┆
└┬ Service provider Y (e.g. Google)
 ├┬ Document type 1 (e.g. Developer Terms)
 │├ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2019-03-12T04-18-22Z.md)
 ┆┆
 │└ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-12-04T22-47-05Z.md)
 └┬ Document type Z (e.g. Privacy Policy)
  ┆
  ├ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-05-02T03-02-15Z.md)
  ┆
  └ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-11-14T12-36-45Z.md)
\`\`\`

### License

This dataset is made available under an [Open Database (OdBL) License](https://opendatacommons.org/licenses/odbl/1.0/) by Open Terms Archive Contributors.
`;
}
