import fs from 'fs/promises';
import path from 'path';

import { expect } from 'chai';
import config from 'config';

describe('Collection', () => {
  const testCollectionPath = path.resolve(process.cwd(), config.get('@opentermsarchive/engine.collectionPath'));
  const metadataPath = path.join(testCollectionPath, 'metadata.yml');
  const inventoryPath = path.join(testCollectionPath, 'deployment/inventory.yml');
  let metadataBackup;
  let getCollection;
  let collection;

  before(async () => {
    try {
      metadataBackup = await fs.readFile(metadataPath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  });

  after(async () => {
    if (metadataBackup) {
      await fs.writeFile(metadataPath, metadataBackup);
    }
  });

  beforeEach(async () => {
    const { getCollection: reloadedGetCollection } = await import(`./index.js?t=${Date.now()}`); // Ensure a new instance is loaded for each test

    getCollection = reloadedGetCollection;
  });

  describe('singleton behavior', () => {
    beforeEach(async () => {
      collection = await getCollection();
    });

    it('returns same instance on multiple calls', async () => {
      const collection2 = await getCollection();

      expect(collection).to.equal(collection2);
    });
  });

  describe('metadata handling', () => {
    const metadata = {
      id: 'test-collection',
      name: 'Test Collection',
      tagline: 'Test collection for testing',
    };

    describe('with existing metadata', () => {
      beforeEach(async () => {
        await fs.mkdir(testCollectionPath, { recursive: true });
        await fs.writeFile(metadataPath, JSON.stringify(metadata));
        collection = await getCollection();
      });

      afterEach(async () => {
        await fs.rm(metadataPath, { recursive: true, force: true });
      });

      it('loads collection id from metadata', () => {
        expect(collection.id).to.equal(metadata.id);
      });

      it('loads collection name from metadata', () => {
        expect(collection.name).to.equal(metadata.name);
      });

      it('loads full metadata object', () => {
        expect(collection.metadata).to.deep.equal(metadata);
      });
    });

    describe('without metadata', () => {
      beforeEach(async () => {
        await fs.rm(metadataPath, { force: true });
        collection = await getCollection();
      });

      it('has undefined metadata', () => {
        expect(collection.metadata).to.be.undefined;
      });

      it('has undefined id', () => {
        expect(collection.id).to.be.undefined;
      });

      it('has undefined name', () => {
        expect(collection.name).to.be.undefined;
      });
    });
  });

  describe('inventory handling', () => {
    const inventory = {
      all: {
        hosts: {
          'test-host': {
            ansible_host: 'localhost',
            ansible_port: 22,
          },
        },
      },
    };

    describe('with existing inventory', () => {
      beforeEach(async () => {
        await fs.mkdir(path.dirname(inventoryPath), { recursive: true });
        await fs.writeFile(inventoryPath, JSON.stringify(inventory));
        collection = await getCollection();
      });

      afterEach(async () => {
        await fs.rm(inventoryPath, { recursive: true, force: true });
      });

      it('loads host from inventory', () => {
        expect(collection.host).to.equal('test-host');
      });

      it('loads host config from inventory', () => {
        expect(collection.hostConfig).to.deep.equal(inventory.all.hosts['test-host']);
      });

      it('loads full inventory object', () => {
        expect(collection.inventory).to.deep.equal(inventory);
      });
    });

    describe('without inventory', () => {
      beforeEach(async () => {
        await fs.rm(inventoryPath, { force: true });
        collection = await getCollection();
      });

      it('has undefined inventory', () => {
        expect(collection.inventory).to.be.undefined;
      });

      it('has undefined host', () => {
        expect(collection.host).to.be.undefined;
      });

      it('has undefined host config', () => {
        expect(collection.hostConfig).to.be.undefined;
      });
    });
  });
});
