import path from 'path';
import config from 'config';
import chai from 'chai';

import loadServiceProviders from './index.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const SERVICE_PROVIDERS_PATH = path.resolve(__dirname, '../..', config.get('serviceProvidersPath'));

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
  describe('#loadServiceProviders', () => {
    it('returns an object with all service providers manifests', async () => {
      const result = await loadServiceProviders(SERVICE_PROVIDERS_PATH);
      expect(result).to.deep.equal(expected);
    });
  });
});
