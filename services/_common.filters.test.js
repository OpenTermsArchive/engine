import { expect } from 'chai';
import { JSDOM } from 'jsdom';
import prettier from 'prettier';

import { removeSIDfromUrls } from './_common.filters.js';

const snapshotHTML = `
<!DOCTYPE html>
<html id="html">
  <head>
    <meta charset="UTF-8">
    <title>TOS</title>
  </head>
  <body>
    <h1>Title</h1>
    <a href="https://www.booking.com/country.en-gb.html?sid=d74065de8c1401be9d57e7f099edc4ed" data-ga="seoindexlinks" rel="nofollow"></a>
    <a href="https://www.booking.com/country.en-gb.html?other-param=678&sid=d74065de8c1401be9d57e7f099edc4ed" data-ga="seoindexlinks" rel="nofollow"></a>
  </body>
</html>`;

const expectedSnapshotCleaned = `
<html id="html">
  <head>
    <meta charset="UTF-8">
    <title>TOS</title>
  </head>
  <body>
    <h1>Title</h1>
    <a href="https://www.booking.com/country.en-gb.html?sid=removed" data-ga="seoindexlinks" rel="nofollow"></a>
    <a href="https://www.booking.com/country.en-gb.html?other-param=678&amp;sid=removed" data-ga="seoindexlinks" rel="nofollow"></a>
  </body>
</html>`;

const applyFilters = document => {
  removeSIDfromUrls(document);
};

describe('Common Filters', () => {
  it('should replace data according to filters', async () => {
    const { document } = new JSDOM(snapshotHTML).window;

    applyFilters(document);
    const result = document.getElementById('html').outerHTML;

    // TODO we should retrieve the whole HTML with doctype but could not figure out a way to do so
    expect(prettier.format(result, { parser: 'html' })).to.equal(prettier.format(expectedSnapshotCleaned, { parser: 'html' }));
  });

  it('should be idempotent', async () => {
    const { document } = new JSDOM(snapshotHTML).window;

    applyFilters(document);
    applyFilters(document);
    const result = document.getElementById('html').outerHTML;

    // TODO we should retrieve the whole HTML with doctype but could not figure out a way to do so
    expect(prettier.format(result, { parser: 'html' })).to.equal(prettier.format(expectedSnapshotCleaned, { parser: 'html' }));
  });
});
