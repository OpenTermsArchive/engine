#! /usr/bin/env node
import './.env.js'; // Workaround to ensure `SUPPRESS_NO_CONFIG_WARNING` is set before config is imported

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { program } from 'commander';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { description, version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)).toString());

program
  .name('ota-track')
  .description(description)
  .version(version)
  .option('-s, --services [serviceId...]', 'service IDs of services to handle')
  .option('-d, --documentTypes [documentType...]', 'terms types to handle')
  .option('-r, --refilter-only', 'only refilter exisiting snapshots with last declarations and engine\'s updates')
  .option('--schedule', 'schedule automatic document tracking');

const track = (await import(pathToFileURL(path.resolve(__dirname, '../src/index.js')))).default;

track(program.parse(process.argv).opts());
