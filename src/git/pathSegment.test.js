import { expect } from 'chai';

import { isPlainPathSegment, isPortableFileName } from './pathSegment.js';

describe('PathSegment', () => {
  describe('#isPlainPathSegment', () => {
    [ 'Facebook', 'Terms of Service', 'Facebook v2.0', 'service·A' ].forEach(segment => {
      it(`accepts ${JSON.stringify(segment)}`, () => {
        expect(isPlainPathSegment(segment)).to.be.true;
      });
    });

    [ '', '.', '..', 'a/b', 'a\\b', 'with\0null', 'line\nbreak' ].forEach(segment => {
      it(`rejects ${JSON.stringify(segment)}`, () => {
        expect(isPlainPathSegment(segment)).to.be.false;
      });
    });
  });

  describe('#isPortableFileName', () => {
    [ 'Facebook', 'Terms of Service', 'Booking.com', 'Yahoo!', 'service·A' ].forEach(segment => {
      it(`accepts ${JSON.stringify(segment)}`, () => {
        expect(isPortableFileName(segment)).to.be.true;
      });
    });

    [ 'Service "A"', 're:start', 'a<b', 'a>b', 'a|b', 'a*b', 'a?b', '', '.', '..', 'a/b', 'a\\b', 'with\0null' ].forEach(segment => {
      it(`rejects ${JSON.stringify(segment)}`, () => {
        expect(isPortableFileName(segment)).to.be.false;
      });
    });
  });
});
