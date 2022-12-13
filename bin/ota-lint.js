#! /usr/bin/env node
import './env.js';

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { program } from 'commander';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

program
  .name('ota lint')
  .description('Check format and stylistic errors in declarations and auto fix them')
  .option('-s, --services [serviceId...]', 'service IDs of services to lint')
  .option('-m, --modified', 'to only lint modified services already commited to git');

const lintDeclarations = (await import(pathToFileURL(path.resolve(__dirname, '../scripts/declarations/lint/index.js')))).default; // load asynchronously to ensure env.js is loaded before

lintDeclarations(program.parse().opts());
