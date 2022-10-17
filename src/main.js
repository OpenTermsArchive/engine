import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import { program } from 'commander';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const track = (await import(pathToFileURL(path.resolve(__dirname, './index.js')))).default; // Dynamic import to ensure `dotenv` loads the `.env` file before

const { name, description, version } = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)).toString());

program
  .name(name)
  .description(description)
  .version(version)
  .option('-s, --services [serviceId...]', 'service IDs of services to handle')
  .option('-d, --documentTypes [documentType...]', 'document types to handle')
  .option('-r, --refilter-only', 'only refilter exisiting snapshots with last declarations and engine\'s updates')
  .option('--schedule', 'schedule automatic document tracking');

track(program.parse().opts());
