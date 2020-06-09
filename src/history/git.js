import fs from 'fs';
import path from 'path';
import git from 'isomorphic-git';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const DEFAULT_GIT_OPTIONS = {
  fs,
  dir: path.resolve(__dirname, '../..'),
  dryRun: process.env.NODE_ENV === 'test',
};

export async function add(filepath) {
  return git.add({ ...DEFAULT_GIT_OPTIONS, filepath });
}

export async function status(filepath) {
  return git.status({ ...DEFAULT_GIT_OPTIONS, filepath });
}

export async function commit(message) {
  return git.commit({
    ...DEFAULT_GIT_OPTIONS,
    author: {
      name: process.env.AUTHOR_NAME,
      email: process.env.AUTHOR_EMAIL,
    },
    message
  });
}
