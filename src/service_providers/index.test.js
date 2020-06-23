import chai from 'chai';
import nock from 'nock';
import fs from 'fs';
import path from 'path';

import getServiceProviders from './index.js';

const expect = chai.expect;

const expected = {
  first_provider: {
    serviceProviderName: 'First Provider',
    documents: {
      tos: {
        url: 'https://www.firstprovider.example/tos',
        contentSelector: 'main'
      }
    }
  },
  second_provider: {
    serviceProviderName: 'Second Provider',
    documents: {
      tos: {
        url: 'https://www.secondprovider.example/tos',
        contentSelector: 'main'
      }
    }
  }

}

describe('ServiceProviders', () => {
  describe('#getServiceProviders', () => {
    it('returns an object with all service providers manifests', async () => {
      const result = await getServiceProviders();
      expect(result).to.deep.equal(expected);
    });
  });
});
