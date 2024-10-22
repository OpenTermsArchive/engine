import config from 'config';

const LOCALE = 'en-EN';
const DATE_OPTIONS = { year: 'numeric', month: 'long', day: 'numeric' };

export default function readme({ releaseDate, servicesCount, firstVersionDate, lastVersionDate, versionsRepositoryURL }) {
  return `# Open Terms Archive — ${title({ releaseDate })}

${body({ servicesCount, firstVersionDate, lastVersionDate, versionsRepositoryURL })}`;
}

export function title({ releaseDate }) {
  releaseDate = releaseDate.toLocaleDateString(LOCALE, DATE_OPTIONS);

  const title = config.get('@opentermsarchive/engine.dataset.title');

  return `${title} — ${releaseDate} dataset`;
}

export function body({ servicesCount, firstVersionDate, lastVersionDate, versionsRepositoryURL }) {
  firstVersionDate = firstVersionDate.toLocaleDateString(LOCALE, DATE_OPTIONS);
  lastVersionDate = lastVersionDate.toLocaleDateString(LOCALE, DATE_OPTIONS);

  return `This dataset consolidates the contractual documents of ${servicesCount} service providers, in all their versions that were accessible online between ${firstVersionDate} and ${lastVersionDate}.

This dataset is tailored for datascientists and other analysts. You can also explore all these versions interactively on [${versionsRepositoryURL}](${versionsRepositoryURL}).

It has been generated with [Open Terms Archive](https://opentermsarchive.org).

### Dataset format

This dataset represents each version of a document as a separate [Markdown](https://spec.commonmark.org/0.30/) file, nested in a directory with the name of the service provider and in a directory with the name of the terms type. The filesystem layout will look like below.

\`\`\`
├ README.md
├┬ Service provider 1 (e.g. Facebook)
│├┬ Terms type 1 (e.g. Terms of Service)
││├ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-08-01T01-03-12Z.md)
┆┆┆
││└ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-10-03T08-12-25Z.md)
┆┆
│└┬ Terms type X (e.g. Privacy Policy)
│ ├ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-05-02T03-02-15Z.md)
┆ ┆
│ └ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-11-14T12-36-45Z.md)
┆
└┬ Service provider Y (e.g. Google)
 ├┬ Terms type 1 (e.g. Developer Terms)
 │├ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2019-03-12T04-18-22Z.md)
 ┆┆
 │└ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-12-04T22-47-05Z.md)
 └┬ Terms type Z (e.g. Privacy Policy)
  ┆
  ├ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-05-02T03-02-15Z.md)
  ┆
  └ YYYY-DD-MMTHH-MM-SSZ.md (e.g. 2021-11-14T12-36-45Z.md)
\`\`\`

### License

This dataset is made available under an [Open Database (OdBL) License](https://opendatacommons.org/licenses/odbl/1.0/) by Open Terms Archive Contributors.
`;
}
