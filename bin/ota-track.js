#! /usr/bin/env node
import './env.js';

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { program } from 'commander';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const track = (await import(pathToFileURL(path.resolve(__dirname, '../src/index.js')))).default; // load asynchronously to ensure env.js is loaded before

program
  .name('ota track')
  .description('Retrieve declared documents, record snapshots, extract versions and publish the resulting records')
  .option('-s, --services [serviceId...]', 'service IDs of services to track')
  .option('-t, --types [termsType...]', 'terms types to track')
  .option('--schedule', 'track automatically at a regular interval');

track(program.parse(process.argv).opts());
