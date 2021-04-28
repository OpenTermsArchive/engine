const CONTRIBUTE_URL = 'http://51.75.169.235:7022/contribute/service';
const GITHUB_VERSIONS_URL = 'https://github.com/ambanum/OpenTermsArchive-versions/blob/master';
const GITHUB_REPO_URL = 'https://github.com/ambanum/OpenTermsArchive/blob/master/services';
const GOOGLE_URL = 'https://www.google.com/search?q=';

export class InaccessibleContentError extends Error {
  constructor(messageOrObject) {
    let returnedMessage = '';
    if (typeof messageOrObject === 'string') {
      returnedMessage = `The document cannot be accessed or its content can not be selected: ${messageOrObject}`;
    } else {
      const {
        message,
        contentSelectors,
        noiseSelectors,
        url,
        name,
        documentType,
      } = messageOrObject;

      const contentSelectorsAsArray = (typeof contentSelectors === 'string'
        ? contentSelectors.split(',')
        : contentSelectors || []
      ).map(encodeURIComponent);

      const noiseSelectorsAsArray = (typeof noiseSelectors === 'string'
        ? noiseSelectors.split(',')
        : noiseSelectors || []
      ).map(encodeURIComponent);

      const contentSelectorsQueryString = contentSelectorsAsArray.length
        ? `&selectedCss[]=${contentSelectorsAsArray.join('&selectedCss[]=')}`
        : '';
      const noiseSelectorsQueryString = noiseSelectorsAsArray
        ? `&removedCss[]=${noiseSelectorsAsArray.join('&removedCss[]=')}`
        : '';

      const encodedName = encodeURIComponent(name);
      const encodedType = encodeURIComponent(documentType);
      const encodedUrl = encodeURIComponent(url);

      const verificationUrl = `${CONTRIBUTE_URL}?step=2&url=${encodedUrl}&name=${encodedName}&documentType=${encodedType}${noiseSelectorsQueryString}${contentSelectorsQueryString}`;

      const githubVersionUrl = `${GITHUB_VERSIONS_URL}/${encodedName}/${encodedType}.md`;

      const githubRepoUrl = `${GITHUB_REPO_URL}/${encodedName}.json`;

      const googleUrl = `${GOOGLE_URL}%22${encodedName}%22+%22${encodedType}%22`;

      const message404 = message.includes('404') ? `Find the new url: ${googleUrl}` : '';

      returnedMessage = `${message}

      ${name} - ${documentType}

      Try modify it here: ${verificationUrl}

      See what has already been tracked here: ${githubVersionUrl}

      See original JSON file: ${githubRepoUrl}

      ${message404}
      `;
    }

    super(returnedMessage);
  }
}
