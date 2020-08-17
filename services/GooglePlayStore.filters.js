import DatauriParser from 'datauri/parser.js';
import fetch from '../src/fetcher/index.js';

const dataUriParser = new DatauriParser();

export async function convertImagesToDataURI(document, { fetch: baseUrl, select: selector }) {
  const images = Array.from(document.querySelectorAll(`${selector} img`));

  return Promise.all(images.map(async ({ src }, index) => {
    if (src.startsWith('data:')) {
      return Promise.resolve(); // Already a data-URI, skip.
    }

    const imageUrl = new URL(src, baseUrl).href; // Ensure url is absolute

    const blob = await fetch(imageUrl, { returnBlob: true });

    const extension = `.${blob.type.split('/')[1].split('+')[0]}`;
    const arrayBuffer = await blob.arrayBuffer();

    images[index].src = dataUriParser.format(extension, arrayBuffer).content;
  }));
}
