import { expect } from 'chai';

import { findServiceCaseInsensitive } from './utils.js';

describe('findServiceCaseInsensitive', () => {
  const services = {
    '42Corp': { id: '42Corp' },
    ACMEco: { id: 'ACMEco' },
    'example.org': { id: 'example.org' },
    'Foo Bar': { id: 'Foo Bar' },
    'service-b': { id: 'service-b' },
    service·A: { id: 'service·A' },
  };

  it('returns the service when the id matches exactly', () => {
    expect(findServiceCaseInsensitive(services, '42Corp')).to.equal(services['42Corp']);
    expect(findServiceCaseInsensitive(services, 'ACMEco')).to.equal(services.ACMEco);
    expect(findServiceCaseInsensitive(services, 'example.org')).to.equal(services['example.org']);
    expect(findServiceCaseInsensitive(services, 'Foo Bar')).to.equal(services['Foo Bar']);
    expect(findServiceCaseInsensitive(services, 'service-b')).to.equal(services['service-b']);
    expect(findServiceCaseInsensitive(services, 'service·A')).to.equal(services['service·A']);
  });

  it('returns the service when the id casing differs', () => {
    expect(findServiceCaseInsensitive(services, '42CORP')).to.equal(services['42Corp']);
    expect(findServiceCaseInsensitive(services, 'acmeco')).to.equal(services.ACMEco);
    expect(findServiceCaseInsensitive(services, 'EXAMPLE.ORG')).to.equal(services['example.org']);
    expect(findServiceCaseInsensitive(services, 'foo bar')).to.equal(services['Foo Bar']);
    expect(findServiceCaseInsensitive(services, 'SERVICE-B')).to.equal(services['service-b']);
    expect(findServiceCaseInsensitive(services, 'SERVICE·A')).to.equal(services['service·A']);
  });

  it('returns null when no service matches', () => {
    expect(findServiceCaseInsensitive(services, 'Unknown')).to.be.null;
  });

  it('returns null when serviceId is undefined', () => {
    expect(findServiceCaseInsensitive(services, undefined)).to.be.null;
  });

  it('returns null when services is empty', () => {
    expect(findServiceCaseInsensitive({}, 'Foo Bar')).to.be.null;
  });
});
