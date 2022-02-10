import fsApi from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import archiver from 'archiver';

import { instantiateVersionsStorageAdapter } from '../../../src/index.js';
import * as renamer from '../../utils/renamer/index.js';
import readme from '../assets/README.template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fs = fsApi.promises;

const ARCHIVE_FORMAT = 'zip'; // for supported formats, see https://www.archiverjs.com/docs/archive-formats

export default async function generate({ archivePath, releaseDate }) {
  const versionsStorageAdapter = await (instantiateVersionsStorageAdapter()).initialize();

  const archive = await initializeArchive(archivePath);

  await renamer.loadRules();

  const services = new Set();
  let firstVersionDate = new Date();
  let lastVersionDate = new Date(0);

  for await (const version of versionsStorageAdapter.iterate()) {
    const { content, fetchDate } = version;
    const { serviceId, documentType } = renamer.applyRules(version.serviceId, version.documentType);

    if (firstVersionDate > fetchDate) {
      firstVersionDate = fetchDate;
    }

    if (fetchDate > lastVersionDate) {
      lastVersionDate = fetchDate;
    }

    services.add(serviceId);

    archive.stream.append(
      content,
      { name: `${archive.basename}/${generateVersionPath({ serviceId, documentType, fetchDate })}` },
    );
  }

  archive.stream.append(
    readme({
      servicesCount: services.size,
      releaseDate,
      firstVersionDate,
      lastVersionDate,
    }),
    { name: `${archive.basename}/README.md` },
  );
  archive.stream.append(
    fsApi.readFileSync(path.resolve(__dirname, '../assets/LICENSE')),
    { name: `${archive.basename}/LICENSE` },
  );

  archive.stream.finalize();

  await archive.done;
  await versionsStorageAdapter.finalize();

  return {
    servicesCount: services.size,
    firstVersionDate,
    lastVersionDate,
  };
}

async function initializeArchive(targetPath) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  const basename = path.basename(targetPath, path.extname(targetPath));

  const output = fsApi.createWriteStream(targetPath);
  const stream = archiver(ARCHIVE_FORMAT, { zlib: { level: 9 } }); // set compression to max level

  const done = new Promise(resolve => {
    output.on('close', resolve);
  });

  stream.pipe(output);

  return { basename, stream, done };
}

function generateVersionPath({ serviceId, documentType, fetchDate }) {
  const fsCompliantDate = fetchDate.toISOString()
    .replace(/\.\d{3}/, '') // remove milliseconds
    .replace(/:|\./g, '-'); // replace `:` and `.` by `-` to be compliant with the file system

  return `${serviceId}/${documentType}/${fsCompliantDate}.md`;
}
