import fs from 'fs';

import { program } from 'commander';

import track from './index.js';

const { name, description, version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)).toString());

program
  .name(name)
  .description(description)
  .version(version)
  .option('-s, --services [serviceId...]', 'service IDs of services to handle')
  .option('-d, --documentTypes [documentType...]', 'document types to handle')
  .option('-r, --refilter-only', 'only refilter exisiting snapshots with last declarations and engine\'s updates')
  .option('--schedule', 'schedule automatic document tracking');

track(program.parse(process.argv).opts());
