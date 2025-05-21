import fs from 'fs/promises';
import path from 'path';

import config from 'config';
import yaml from 'js-yaml';

const METADATA_FILENAME = 'metadata.yml';
const INVENTORY_FILENAME = 'deployment/inventory.yml';

class Collection {
  metadata;
  id;
  name;
  inventory;
  host;
  hostConfig;
  collectionPath;

  constructor() {
    this.collectionPath = path.resolve(process.cwd(), config.get('@opentermsarchive/engine.collectionPath'));
  }

  async loadYamlFile(filename) {
    const content = await fs.readFile(path.join(this.collectionPath, filename), 'utf8');

    return yaml.load(content);
  }

  async initialize() {
    const fileLoadingPromises = await Promise.allSettled([
      this.loadYamlFile(METADATA_FILENAME),
      this.loadYamlFile(INVENTORY_FILENAME),
    ]);

    const [ metadata, inventory ] = fileLoadingPromises.map(({ status, value, reason }) => {
      if (status === 'fulfilled') {
        return value;
      }

      if (reason && reason.code !== 'ENOENT') { // Ignore missing files errors (inventory and metadata are optional), but throw other errors like invalid YAML
        throw reason;
      }

      return null;
    });

    if (metadata) {
      this.metadata = metadata;
      this.id = metadata.id;
      this.name = metadata.name;
    }

    if (inventory) {
      const [host] = Object.keys(inventory.all.hosts);

      this.inventory = inventory;
      this.host = host;
      this.hostConfig = inventory.all.hosts[host];
    }

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
