#! /usr/bin/env node
import './env.js';

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { program } from 'commander';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { applyTechnicalUpgrades } = await import(pathToFileURL(path.resolve(__dirname, '../src/index.js'))); // load asynchronously to ensure env.js is loaded before

program
  .name('ota apply-technical-upgrades')
  .description('Apply technical upgrades by generating new versions from the latest snapshots using updated declarations, engine logic, or dependencies, and by retrieving any missing snapshots for newly added source documents')
  .option('-s, --services [serviceId...]', 'service IDs to apply technical upgrades to')
  .option('-t, --types [termsType...]', 'terms types to apply technical upgrades to');

applyTechnicalUpgrades(program.parse(process.argv).opts());
