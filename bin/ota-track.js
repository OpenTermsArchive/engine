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
  .option('--shard [chunkOf]', 'run only a specific chunk of the serviceIds queue, e.g. "--shard 0/3", "--shard 1/3", "--shard 2/3" will run three equal chunks')
  .option('-e, --extract-only', 'extract versions from existing snapshots with latest declarations and engine, without recording new snapshots')
  .option('--schedule', 'track automatically at a regular interval')
  .option('--skipPreRun', 'skip the pre run')
  .option('--skipReadBack', 'skip the read-back of snapshots')
  .option('--skipSnapshots', 'skip both the writing and the read-back of the snapshots');

track(program.parse(process.argv).opts());
