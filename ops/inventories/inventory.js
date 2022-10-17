#! /usr/bin/env node

import fs from 'fs/promises';
import path from 'path';

process.env.SUPPRESS_NO_CONFIG_WARNING = 'y';
const config = (await import('config')).default; // Use dynamic import to ensure `SUPPRESS_NO_CONFIG_WARNING` is set before config is imported

// Initialise configs to allow clients of this module to use it without requiring node-config in their own application.
// see https://github.com/lorenwest/node-config/wiki/Sub-Module-Configuration
config.util.setModuleDefaults('services', { declarationsPath: path.resolve(process.cwd(), './declarations') });

const DECLARATIONS_PATH = config.get('services.declarationsPath');

const configFile = JSON.parse(await fs.readFile(path.resolve(DECLARATIONS_PATH, '../', 'config/production.json'), 'utf-8'));

console.log(JSON.stringify(
  { contrib: { hosts: [configFile.host], vars: { ansible_user: configFile.user } } },
  null,
  2,
));
