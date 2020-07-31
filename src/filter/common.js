import DatauriParser from 'datauri/parser.js';
import fetch from '../fetcher/index.js';

const dataUriParser = new DatauriParser();

function cleanAttribute (attribute) {
  return attribute ? attribute.replace(/(\n+\s*)+/g, '\n') : '';
}

export async function convertImagesToDataURI(document, url) {
  const imgs = document.querySelectorAll('img');

  const promises = [];
  imgs.forEach((img, index) => {
    promises.push((async () => {
      const src = img.src;

      let localSrc = src;
      if (!src.startsWith('data:')) {  // Not a data-URI, download content
        let queryUrl = src;
        if (!src.startsWith('http:') && !src.startsWith('https:')) {  // Relative URL
          queryUrl = new URL(src, url).href;
        }
        const blob = await fetch(queryUrl);
        const type = blob.type;
        const arrayBuffer = await blob.arrayBuffer();
        localSrc = dataUriParser.format(`.${type.split('/')[1].split('+')[0]}`, arrayBuffer);
      }
      imgs[index].src = localSrc.content;
    })());
  });
  return Promise.all(promises);
}
