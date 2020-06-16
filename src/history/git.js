import path from 'path';

import dotenv from 'dotenv';
dotenv.config();
import simpleGit from 'simple-git';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const DATA_PATH = '../../data';

export const git = simpleGit(path.resolve(__dirname, DATA_PATH));

if (process.env.CI || process.env.NODE_ENV === 'production') {
  git.addConfig('user.name', process.env.AUTHOR_NAME)
     .addConfig('user.email', process.env.AUTHOR_EMAIL);
}

export async function add(filepath) {
  return git.add(relativePath(filepath));
}

export async function status() {
  return git.status();
}

export async function commit(filepath, message) {
  return git.commit(message, relativePath(filepath), { '--author': `${process.env.AUTHOR_NAME} <${process.env.AUTHOR_EMAIL}>` });
}

export async function pushChanges() {
  return git.push('origin', 'master');
}

export async function fileNeedsCommit(filepath) {
  const status = await git.status();
  return (status.modified.indexOf(relativePath(filepath)) > -1) ||
           (status.not_added.indexOf(relativePath(filepath)) > -1);
}

export function relativePath(absolutePath) {
  // Git needs a path relative to the .git directory, not an absolute one
  return path.relative(path.resolve(__dirname, DATA_PATH), absolutePath);
}
