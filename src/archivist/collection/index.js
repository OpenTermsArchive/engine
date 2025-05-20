import fs from 'fs/promises';
import path from 'path';

import config from 'config';
import yaml from 'js-yaml';

const METADATA_FILENAME = 'metadata.yml';
const INVENTORY_FILENAME = 'deployment/inventory.yml';

class Collection {
  metadata;
  inventory;
  host;
  collectionPath;

  constructor() {
    this.collectionPath = path.resolve(process.cwd(), config.get('@opentermsarchive/engine.collectionPath'));
  }

  async initialize() {
    const [ metadataContent, inventoryContent ] = await Promise.all([
      fs.readFile(path.join(this.collectionPath, METADATA_FILENAME), 'utf8'),
      fs.readFile(path.join(this.collectionPath, INVENTORY_FILENAME), 'utf8'),
    ]);

    const [ metadata, inventory ] = [ yaml.load(metadataContent), yaml.load(inventoryContent) ];
    const [host] = Object.keys(inventory.all.hosts);

    this.metadata = metadata;
    this.inventory = inventory;

    this.id = metadata.id;
    this.name = metadata.name;
    this.host = host;
    this.hostConfig = inventory.all.hosts[host];

    return this;
  }
}

let instancePromise = null;

export async function getCollection() {
  if (!instancePromise) {
    const collection = new Collection();

    instancePromise = await collection.initialize();
  }

  return instancePromise;
}
