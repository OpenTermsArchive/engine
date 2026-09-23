import { expect } from 'chai';

import { parseTrailers, formatTrailers } from './trailers.js';

describe('trailers', () => {
  describe('#parseTrailers', () => {
    it('returns empty object for message without trailers', () => {
      const message = 'A simple commit message\n\nWith a body';

      expect(parseTrailers(message)).to.deep.equal({});
    });

    it('returns empty object when last section has no colon', () => {
      const message = 'A commit message\n\nWith a body\n\nNo trailers here';

      expect(parseTrailers(message)).to.deep.equal({});
    });

    it('parses single word trailer key', () => {
      const message = 'A commit message\n\nWith a body\n\nFetcher: my-fetcher';

      expect(parseTrailers(message)).to.deep.equal({ fetcher: 'my-fetcher' });
    });

    it('parses multi-word trailer key with dashes', () => {
      const message = 'A commit message\n\nWith a body\n\nFeature-Request: my-feature';

      expect(parseTrailers(message)).to.deep.equal({ 'feature-request': 'my-feature' });
    });

    it('parses multiple trailers with different key formats', () => {
      const message = 'A commit message\n\nWith a body\n\nFetcher: my-fetcher\nFeature-Request: my-feature';

      expect(parseTrailers(message)).to.deep.equal({
        fetcher: 'my-fetcher',
        'feature-request': 'my-feature',
      });
    });

    it('handles case-insensitive keys', () => {
      const message = 'A commit message\n\nWith a body\n\nFETCHER: my-fetcher\nFeature-Request: my-feature';

      expect(parseTrailers(message)).to.deep.equal({
        fetcher: 'my-fetcher',
        'feature-request': 'my-feature',
      });
    });

    it('handles trailers with colons in values', () => {
      const message = 'A commit message\n\nWith a body\n\nFetcher: my:fetcher:with:colons';

      expect(parseTrailers(message)).to.deep.equal({ fetcher: 'my:fetcher:with:colons' });
    });

    it('ignores malformed trailer lines', () => {
      const message = 'A commit message\n\nWith a body\n\nFetcher: my-fetcher\nInvalid line\nReviewer: john-doe';

      expect(parseTrailers(message)).to.deep.equal({
        fetcher: 'my-fetcher',
        reviewer: 'john-doe',
      });
    });

    it('ignores trailer keys with spaces', () => {
      const message = 'A commit message\n\nWith a body\n\nFeature Request: my-feature\nFetcher: my-fetcher';

      expect(parseTrailers(message)).to.deep.equal({ fetcher: 'my-fetcher' });
    });

    it('ignores trailer keys with spaces before colon', () => {
      const message = 'A commit message\n\nWith a body\n\nFetcher : my-fetcher\nFeature-Request: my-feature';

      expect(parseTrailers(message)).to.deep.equal({ 'feature-request': 'my-feature' });
    });

    it('ignores trailer keys ending with dash', () => {
      const message = 'A commit message\n\nWith a body\n\nFeature-: my-feature\nFetcher: my-fetcher';

      expect(parseTrailers(message)).to.deep.equal({ fetcher: 'my-fetcher' });
    });

    it('only keeps trailers from the last section', () => {
      const message = 'A commit message\n\nWith a body\n\nFetcher: my-fetcher\n\nFeature-Request: my-feature';

      expect(parseTrailers(message)).to.deep.equal({ 'feature-request': 'my-feature' });
    });

    it('ignores trailers with empty values', () => {
      const message = 'A commit message\n\nWith a body\n\nFetcher:\nFeature-request: my-feature';

      expect(parseTrailers(message)).to.deep.equal({ 'feature-request': 'my-feature' });
    });

    it('handles keys with numbers', () => {
      const message = 'A commit message\n\nWith a body\n\nIssue-123: my-issue\nFetcher: my-fetcher';

      expect(parseTrailers(message)).to.deep.equal({
        'issue-123': 'my-issue',
        fetcher: 'my-fetcher',
      });
    });

    it('handles multiple consecutive empty lines in message', () => {
      const message = 'A commit message\n\n\n\nWith a body\n\nFetcher: my-fetcher';

      expect(parseTrailers(message)).to.deep.equal({ fetcher: 'my-fetcher' });
    });
  });

  describe('#formatTrailers', () => {
    it('returns empty string when no trailers', () => {
      expect(formatTrailers({})).to.equal('');
    });

    it('formats single word trailer key', () => {
      expect(formatTrailers({ fetcher: 'my-fetcher' })).to.equal('Fetcher: my-fetcher');
    });

    it('formats multi-word trailer key with dashes', () => {
      expect(formatTrailers({ 'feature-request': 'my-feature' })).to.equal('Feature-request: my-feature');
    });

    it('formats multiple trailers with different key formats', () => {
      expect(formatTrailers({
        fetcher: 'my-fetcher',
        'feature-request': 'my-feature',
      })).to.equal('Fetcher: my-fetcher\nFeature-request: my-feature');
    });

    it('capitalizes trailer keys', () => {
      expect(formatTrailers({
        fetcher: 'my-fetcher',
        'feature-request': 'my-feature',
      })).to.equal('Fetcher: my-fetcher\nFeature-request: my-feature');
    });

    it('handles case-insensitive keys', () => {
      expect(formatTrailers({
        FETCHER: 'my-fetcher',
        'FEATURE-REQUEST': 'my-feature',
      })).to.equal('Fetcher: my-fetcher\nFeature-request: my-feature');
    });

    it('skips empty string values', () => {
      expect(formatTrailers({
        fetcher: '',
        'feature-request': 'my-feature',
      })).to.equal('Feature-request: my-feature');
    });

    it('handles keys with numbers', () => {
      expect(formatTrailers({
        'issue-123': 'my-issue',
        fetcher: 'my-fetcher',
      })).to.equal('Issue-123: my-issue\nFetcher: my-fetcher');
    });
  });
});
