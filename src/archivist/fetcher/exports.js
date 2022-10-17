import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import fetcher from './index.js';

process.env.SUPPRESS_NO_CONFIG_WARNING = 'y';
const config = (await import('config')).default; // Use dynamic import to ensure `SUPPRESS_NO_CONFIG_WARNING` is set before config is imported

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultConfigs = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../config/default.json')));

config.util.setModuleDefaults('fetcher', defaultConfigs.fetcher);

export { launchHeadlessBrowser, stopHeadlessBrowser } from './index.js';

export default fetcher;
