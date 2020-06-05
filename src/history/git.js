import fs from 'fs';
import path from 'path';
import git from 'isomorphic-git';

const DEFAULT_GIT_OPTIONS = {
  fs,
  dir: path.resolve(),
  dryRun: process.env.NODE_ENV === 'test'
};

export async function add({ filepath }) {
  return await git.add({ ...DEFAULT_GIT_OPTIONS, filepath });
}

export async function status({ filepath }) {
  return await git.status({ ...DEFAULT_GIT_OPTIONS, filepath });
}

export async function commit(options) {
  let name = 'AmbaNum Bot';
  let email = 'ambanum.bot@disinfo.quaidorsay.fr';

  if (options.author) {
    name = options.author.name || name;
    email = options.author.email || email;
  }

  const sha = await git.commit({
    ...DEFAULT_GIT_OPTIONS,
    author: {
      name,
      email,
    },
    message: options.message
  });

  return sha;
}
