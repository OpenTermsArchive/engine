#! /usr/bin/env node
import './env.js';

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { program } from 'commander';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const track = (await import(pathToFileURL(path.resolve(__dirname, '../src/index.js')))).default; // load asynchronously to ensure env.js is loaded before

program
  .name('ota track')
  .description('Retrieve declared terms, record snapshots, extract versions and publish the resulting records')
  .option('-s, --services [serviceId...]', 'service IDs of services to track')
  .option('-t, --terms-types [termsType...]', 'terms types to track')
  .option('-e, --extract-only', 'extract versions from existing snapshots with latest declarations and engine, without recording new snapshots')
  .option('--schedule', 'schedule automatic terms tracking');

track(program.parse(process.argv).opts());
