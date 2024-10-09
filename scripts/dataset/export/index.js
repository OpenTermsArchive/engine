import fsApi from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import archiver from 'archiver';
import config from 'config';

import RepositoryFactory from '../../../src/archivist/recorder/repositories/factory.js';
import * as renamer from '../../utils/renamer/index.js';
import readme from '../assets/README.template.js';
import logger from '../logger/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fs = fsApi.promises;

const ARCHIVE_FORMAT = 'zip'; // for supported formats, see https://www.archiverjs.com/docs/archive-formats

export default async function generate({ archivePath, releaseDate, versionsRepositoryURL }) {
  const versionsRepository = await RepositoryFactory.create(config.get('@opentermsarchive/engine.recorder.versions.storage')).initialize();

  const archive = await initializeArchive(archivePath);

  await renamer.loadRules();

  const services = new Set();
  let firstVersionDate = new Date();
  let lastVersionDate = new Date(0);

  let index = 1;

  for await (const version of versionsRepository.iterate()) {
    const { content, fetchDate } = version;

    for (const { serviceId, termsType } of renamer.applyRules(version.serviceId, version.termsType)) {
      if (firstVersionDate > fetchDate) {
        firstVersionDate = fetchDate;
      }

      if (fetchDate > lastVersionDate) {
        lastVersionDate = fetchDate;
      }

      services.add(serviceId);

      const versionPath = generateVersionPath({ serviceId, termsType, fetchDate });

      logger.info({ message: versionPath, counter: index, hash: version.id });

      archive.stream.append(
        content,
        { name: `${archive.basename}/${versionPath}` },
      );
      index++;
    }
  }

  archive.stream.append(
    readme({
      servicesCount: services.size,
      releaseDate,
      firstVersionDate,
      lastVersionDate,
      versionsRepositoryURL,
    }),
    { name: `${archive.basename}/README.md` },
  );
  archive.stream.append(
    fsApi.readFileSync(path.resolve(__dirname, '../assets/LICENSE')),
    { name: `${archive.basename}/LICENSE` },
  );

  archive.stream.finalize();

  await archive.done;
  await versionsRepository.finalize();

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

function generateVersionPath({ serviceId, termsType, fetchDate }) {
  const fsCompliantDate = fetchDate.toISOString()
    .replace(/\.\d{3}/, '') // remove milliseconds
    .replace(/:|\./g, '-'); // replace `:` and `.` by `-` to be compliant with the file system

  return `${serviceId}/${termsType}/${fsCompliantDate}.md`;
}
