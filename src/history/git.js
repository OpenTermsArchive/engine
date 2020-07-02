import path from 'path';

import config from 'config';
import dotenv from 'dotenv';
import simpleGit from 'simple-git';

dotenv.config();
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const DATA_PATH = (process.env.CI ? '' : '../') + '../../cgus-data';

export const git = simpleGit(path.resolve(__dirname, DATA_PATH));

if (process.env.CI || process.env.NODE_ENV === 'production') {
  git.addConfig('user.name', config.get('history.author.name'))
     .addConfig('user.email', config.get('history.author.email'));
}

export async function add(filepath) {
  return git.add(relativePath(filepath));
}

export async function status() {
  return git.status();
}

export async function commit(filepath, message) {
  const summary = await git.commit(message, relativePath(filepath), { '--author': `${config.get('history.author.name')} <${config.get('history.author.email')}>` });
  return summary.commit.replace('HEAD ', '');
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
