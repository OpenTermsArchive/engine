import fsApi from 'fs';

import mime from 'mime';

const fs = fsApi.promises;

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
  }
}

export async function loadFile(repoPath, relativeFilePath) {
  const absoluteFilePath = `${repoPath}/${relativeFilePath}`;

  const mimeType = mime.getType(absoluteFilePath);
  const readFileOptions = {};
  if (mimeType.startsWith('text/')) {
    readFileOptions.encoding = 'utf8';
  }
  return {
    content: await fs.readFile(absoluteFilePath, readFileOptions),
    mimeType,
  };
}
