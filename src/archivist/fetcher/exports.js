import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import config from 'config';

import fetcher from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultConfigs = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../config/default.json')));

config.util.setModuleDefaults('fetcher', defaultConfigs.fetcher);

export { launchHeadlessBrowser, stopHeadlessBrowser } from './index.js';

export default fetcher;
