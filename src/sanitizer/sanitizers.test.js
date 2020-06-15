import chai from 'chai';
import jsdom from 'jsdom';

const { JSDOM } = jsdom;
const expect = chai.expect;

const termsHTML = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Facebook TOS</title>
  </head>
  <body>
    <a id="linkToClean" href="https://l.facebook.com/l.php?u=https%3A%2F%2Fen.facebookbrand.com%2Ftrademarks%2F&amp;h=AT3-XPMvMf7l_fWhLDDCOsfL-nG8RMsPYvkp2LxCH1ZFucpbXA_daRp4cSCOru6zkMrLKzhWGG711HSY0tWtFwTbiz81U7Anz7N2DzGTyUakuSlQ5tOcnUO3u0pXbPzvSDrnRZ5maBqGSnmLPNIH" rel="nofollow" target="_blank" data-lynx-mode="hover">trademarks (or any similar marks)</a>
    <a id="linkToKeep" href="https://www.facebook.com/help/224562897555674?ref=tos">delete</a>
  </body>
</html>`;

import { cleanFacebookUrls } from './sanitizers.js';

describe('Sanitizers', () => {
  describe('#cleanFacebookUrls', () => {
    let linkToClean;
    let linkToKeep;

    before(() => {
      const { document } = new JSDOM(termsHTML).window;
      cleanFacebookUrls(document);
      linkToClean = document.querySelector('#linkToClean');
      linkToKeep = document.querySelector('#linkToKeep');
    });

    it('removes useless hash from links’ urls', async () => {
      expect(linkToClean.href).to.be.equal('https://l.facebook.com/l.php?u=https%3A%2F%2Fen.facebookbrand.com%2Ftrademarks%2F');
    });

    it('leaves others links untouched', async () => {
      expect(linkToKeep.href).to.be.equal('https://www.facebook.com/help/224562897555674?ref=tos');
    });
  });
});
