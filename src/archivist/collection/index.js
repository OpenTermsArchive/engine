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
    try {
      const content = await fs.readFile(path.join(this.collectionPath, filename), 'utf8');

      return { content: yaml.load(content), error: null };
    } catch (error) {
      return { content: null, error };
    }
  }

  async initialize() {
    const [ metadata, inventory ] = await Promise.all([
      this.loadYamlFile(METADATA_FILENAME),
      this.loadYamlFile(INVENTORY_FILENAME),
    ]);

    [ metadata, inventory ].forEach(result => {
      if (result.error && result.error.code !== 'ENOENT') { // Allow inventory and metadata files to be optional, but throw an error if they exist but are invalid
        throw result.error;
      }
    });

    if (metadata.content) {
      this.metadata = metadata.content;
      this.id = metadata.content.id;
      this.name = metadata.content.name;
    }

    if (inventory.content) {
      const [host] = Object.keys(inventory.content.all.hosts);

      this.inventory = inventory.content;
      this.host = host;
      this.hostConfig = inventory.content.all.hosts[host];
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
