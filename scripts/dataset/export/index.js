import fsApi from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';

import archiver from 'archiver';
import config from 'config';

import RepositoryFactory from '../../../src/archivist/recorder/repositories/factory.js';
import { TEMPORARY_SUFFIX } from '../../../src/dataset/storage.js';
import * as renamer from '../../utils/renamer/index.js';
import readme from '../assets/README.template.js';
import logger from '../logger/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const fs = fsApi.promises;

const ARCHIVE_FORMAT = 'zip'; // for supported formats, see https://www.archiverjs.com/docs/archive-formats

export default async function generate({ archivePath, releaseDate }) {
  const versionsRepository = await RepositoryFactory.create(config.get('@opentermsarchive/engine.recorder.versions.storage')).initialize();

  const temporaryArchivePath = `${archivePath}${TEMPORARY_SUFFIX}`;
  const archive = await initializeArchive(temporaryArchivePath, path.basename(archivePath, path.extname(archivePath)));

  try {
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
      }),
      { name: `${archive.basename}/README.md` },
    );
    archive.stream.append(
      fsApi.readFileSync(path.resolve(__dirname, '../assets/LICENSE')),
      { name: `${archive.basename}/LICENSE` },
    );

    await Promise.all([ archive.stream.finalize(), archive.done ]); // Both promises settle on the same underlying zip module error; awaiting only `done` left `finalize`'s rejection unhandled
    await fs.rename(temporaryArchivePath, archivePath); // The archive appears under its final name only once complete, so a crash never leaves a truncated dataset where the collection API would serve it

    return {
      servicesCount: services.size,
      firstVersionDate,
      lastVersionDate,
    };
  } catch (error) {
    archive.stream.destroy();
    await archive.done.catch(() => {}); // The write stream has to be closed before the file can be removed on Windows
    await fs.rm(temporaryArchivePath, { force: true });
    throw error;
  } finally {
    await versionsRepository.finalize();
  }
}

async function initializeArchive(targetPath, basename) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });

  const output = fsApi.createWriteStream(targetPath);
  const stream = archiver(ARCHIVE_FORMAT, { zlib: { level: 9 } }); // set compression to max level
  const done = pipeline(stream, output); // Unlike waiting for the close event, the pipeline promise also rejects when either stream fails

  return { basename, stream, done };
}

function generateVersionPath({ serviceId, termsType, fetchDate }) {
  const fsCompliantDate = fetchDate.toISOString()
    .replace(/\.\d{3}/, '') // remove milliseconds
    .replace(/:|\./g, '-'); // replace `:` and `.` by `-` to be compliant with the file system

  return `${serviceId}/${termsType}/${fsCompliantDate}.md`;
}
