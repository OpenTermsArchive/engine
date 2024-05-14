#! /usr/bin/env node
import './env.js';

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await import(pathToFileURL(path.resolve(__dirname, '../src/collection-api/server.js'))); // load asynchronously to ensure env.js is loaded before
