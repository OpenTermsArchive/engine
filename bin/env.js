import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.SUPPRESS_NO_CONFIG_WARNING = 'y'; // Caller don't get "no config files" warnings if it does define configuration files

const OTA_CONFIG_DIR = path.resolve(`${__dirname}./../config/`);
const PROCESS_CONFIG_DIR = path.resolve(`${process.cwd()}/config/`);

process.env.NODE_CONFIG_DIR = OTA_CONFIG_DIR + path.delimiter + PROCESS_CONFIG_DIR; // Ensure OTA config is loaded and loaded before caller config
