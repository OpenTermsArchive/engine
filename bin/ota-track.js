#! /usr/bin/env node
import './.env.js';

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { program } from 'commander';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const track = (await import(pathToFileURL(path.resolve(__dirname, '../src/index.js')))).default; // asynchronous loading to ensure .env.js is load before

program
  .description('Retrieve declared documents, then record snapshots and extract versions, then publish the resulting records')
  .option('-s, --services [serviceId...]', 'service IDs of services to handle')
  .option('-d, --documentTypes [documentType...]', 'terms types to handle')
  .option('-r, --refilter-only', 'only refilter exisiting snapshots with last declarations and engine\'s updates')
  .option('--schedule', 'schedule automatic document tracking');

track(program.parse(process.argv).opts());
