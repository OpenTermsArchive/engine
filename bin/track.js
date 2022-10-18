#! /usr/bin/env node
import './.env.js'; // Workaround to ensure `SUPPRESS_NO_CONFIG_WARNING` is set before config is imported

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import config from 'config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultConfigs = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../config/default.json')));

// Initialise configs to allow clients of this module to use it without requiring node-config in their own application.
// see https://github.com/lorenwest/node-config/wiki/Sub-Module-Configuration
config.util.setModuleDefaults('services', { declarationsPath: path.resolve(process.cwd(), './declarations') });
config.util.setModuleDefaults('fetcher', defaultConfigs.fetcher);
config.util.setModuleDefaults('recorder', config.util.extendDeep({}, defaultConfigs.recorder, {
  versions: { storage: { git: { path: path.resolve(process.cwd(), './data/versions') } } },
  snapshots: { storage: { git: { path: path.resolve(process.cwd(), './data/snapshots') } } },
}));
config.util.setModuleDefaults('logger', defaultConfigs.logger);
// we do not want any tracker when launching through this command line
config.util.setModuleDefaults('tracker', {});

import(pathToFileURL(path.resolve(__dirname, '../src/main.js')));
