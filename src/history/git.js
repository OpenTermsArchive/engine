import fs from 'fs';
import path from 'path';

import dotenv from 'dotenv';
dotenv.config();
import simpleGit from 'simple-git';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export const git = simpleGit(path.resolve(__dirname, '../..'));

if (process.env.CI) {
  git.addConfig('user.name', process.env.AUTHOR_NAME)
     .addConfig('user.email', process.env.AUTHOR_EMAIL);
}

export async function add(filepath) {
  return git.add(filepath);
}

export async function status() {
  return git.status();
}

export async function commit(filepath, message) {
  return git.commit(message, filepath, { '--author': `"${process.env.AUTHOR_NAME} <${process.env.AUTHOR_EMAIL}>"` });
}
