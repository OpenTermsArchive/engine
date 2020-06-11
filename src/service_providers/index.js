import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const dirPath = path.resolve(__dirname, `../..${process.env.NODE_ENV === 'test' ? '/test/' : '/'}providers`)

export default function serviceProviders() {
  const result = {};

  fs.readdirSync(dirPath).forEach((filename) => {
    const serviceProviderId = path.basename(filename, '.json');
    if (serviceProviderId.indexOf('.') === 0) {
      return;  // ignore invisible files such as .DS_Store
    }

    result[serviceProviderId] = JSON.parse(fs.readFileSync(path.join(dirPath, filename)));
  });

  return result;
}
