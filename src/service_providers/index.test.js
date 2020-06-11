import chai from 'chai';
import nock from 'nock';
import fs from 'fs';
import path from 'path';

import serviceProviders from './index.js';

const expect = chai.expect;

const expectResult = {
  first_provider: {
    serviceProviderName: 'First Provider',
    documents: {
      tos: {
        url: 'https://www.firstprovider.com/tos',
        contentSelector: 'main'
      }
    }
  },
  second_provider: {
    serviceProviderName: 'Second Provider',
    documents: {
      tos: {
        url: 'https://www.secondprovider.com/tos',
        contentSelector: 'main'
      }
    }
  }

}

describe('ServiceProviders', () => {
  describe('#serviceProviders', () => {
    it('returns an object with all service providers manifests', () => {
      const result = serviceProviders();
      expect(result).to.deep.equal(expectResult);
    });
  });
});
