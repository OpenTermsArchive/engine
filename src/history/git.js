import path from 'path';
import config from 'config';

import simpleGit from 'simple-git';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const DATA_PATH = path.resolve(__dirname, '../..', config.get('history.dataPath'));
console.log('Using database:', path.resolve(__dirname, DATA_PATH));

const AUTHOR = config.get('history.author');
export const git = simpleGit(DATA_PATH);

git.addConfig('user.name', AUTHOR.name)
   .addConfig('user.email', AUTHOR.email);

export async function add(filepath) {
  return git.add(relativePath(filepath));
}

export async function status() {
  return git.status();
}

export async function commit(filepath, message) {
  const summary = await git.commit(message, relativePath(filepath));
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
