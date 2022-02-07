import fsApi from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import archiver from 'archiver';
import config from 'config';

import GitAdapter from '../../../src/storage-adapters/git/index.js';
import MongoAdapter from '../../../src/storage-adapters/mongo/index.js';
import * as renamer from '../../utils/renamer/index.js';
import readme from '../assets/README.template.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const locale = 'en-EN';
const dateOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };

export default async function generateArchive({ archivePath, releaseDate }) {
  const versionsStorageAdapter = await initVersionsStorageAdapter();
  const { archive, archiveName, archiveWrittenPromise } = await initializeArchive(archivePath);

  await renamer.loadRules();

  const periodDates = { first: null, last: null };
  const services = new Set();

  for await (const record of versionsStorageAdapter.iterate()) {
    const { serviceId, documentType, ...othersRecordAttributes } = record;
    const { serviceId: renamedServiceId, documentType: renamedDocumentType } = renamer.applyRules(serviceId, documentType);

    addRecordToArchive({
      record: { serviceId: renamedServiceId, documentType: renamedDocumentType, ...othersRecordAttributes },
      periodDates,
      services,
      archive,
      archiveName,
    });
  }

  addReadmeAndLicenseToArchive({ releaseDate, periodDates, services, archive, archiveName });

  archive.finalize();

  await archiveWrittenPromise;

  return {
    servicesCount: services.size,
    firstCommitDate: periodDates.first.toLocaleDateString(locale, dateOptions),
    lastCommitDate: periodDates.last.toLocaleDateString(locale, dateOptions),
  };
}

async function initVersionsStorageAdapter() {
  let versionsStorageAdapter;

  if (config.has('recorder.versions.storage.git')) {
    versionsStorageAdapter = new GitAdapter({
      ...config.get('recorder.versions.storage.git'),
      path: path.resolve(__dirname, '../../../', config.get('recorder.versions.storage.git.path')),
      fileExtension: 'md',
    });
  } else if (config.has('recorder.versions.storage.mongo')) {
    versionsStorageAdapter = new MongoAdapter(config.get('recorder.versions.storage.mongo'));
  }

  await versionsStorageAdapter.initialize();

  return versionsStorageAdapter;
}

async function initializeArchive(archivePath) {
  fsApi.mkdirSync(path.dirname(archivePath), { recursive: true });

  const archiveExtension = path.extname(archivePath);
  const archiveName = path.basename(archivePath, archiveExtension);

  const output = fsApi.createWriteStream(archivePath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const archiveWrittenPromise = new Promise(resolve => {
    output.on('close', () => resolve());
  });

  archive.pipe(output);

  return { archive, archiveName, archiveWrittenPromise };
}

function addRecordToArchive({ record, periodDates, services, archive, archiveName }) {
  const { serviceId, documentType, content, fetchDate } = record;

  if (!periodDates.last || new Date(fetchDate) > new Date(periodDates.last)) {
    periodDates.last = fetchDate;
  }

  if (!periodDates.first || new Date(fetchDate) < new Date(periodDates.first)) {
    periodDates.first = fetchDate;
  }

  services.add(serviceId);

  const fileName = fetchDate.toISOString()
    .replace(/\.\d{3}/, '') // Remove milliseconds
    .replace(/:|\./g, '-'); // Replace `:` and `.` by `-` to be compliant with the file system

  archive.append(content, { name: `${archiveName}/${serviceId}/${documentType}/${fileName}.md` });
}

function addReadmeAndLicenseToArchive({ releaseDate, periodDates, services, archive, archiveName }) {
  archive.append(
    readme({
      servicesRepositoryName: config.get('dataset.servicesRepositoryName'),
      releaseDate: releaseDate.toLocaleDateString(locale, dateOptions),
      servicesCount: services.size,
      firstCommitDate: periodDates.first.toLocaleDateString(locale, dateOptions),
      lastCommitDate: periodDates.last.toLocaleDateString(locale, dateOptions),
      versionsRepositoryURL: config.get('dataset.versionsRepositoryURL'),
    }),
    { name: `${archiveName}/README.md` },
  );
  archive.append(
    fsApi.readFileSync(path.resolve(__dirname, '../assets/LICENSE')),
    { name: `${archiveName}/LICENSE` },
  );
}
