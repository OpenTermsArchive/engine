#! /usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log([ path.resolve(__dirname, '../', './ops/playbook.yml'), ...process.argv.slice(2) ]);

spawn('ansible-playbook', [ path.resolve(__dirname, '../', './ops/playbook.yml'), ...process.argv.slice(2) ], { stdio: 'inherit' });
