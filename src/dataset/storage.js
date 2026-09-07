import fs from 'fs/promises';
import path from 'path';

export const TEMPORARY_SUFFIX = '.tmp';

const METADATA_FILENAME = 'metadata.json';
const ARCHIVE_EXTENSION = '.zip';

export default class DatasetStorage {
  constructor(storagePath) {
    this.path = path.resolve(process.cwd(), storagePath);
  }

  get metadataPath() {
    return path.join(this.path, METADATA_FILENAME);
  }

  archivePath(filename) {
    return path.join(this.path, filename);
  }

  async findLatest() {
    let metadata;

    try {
      metadata = JSON.parse(await fs.readFile(this.metadataPath, 'utf8'));
      await fs.access(this.archivePath(metadata.filename));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }

      throw error;
    }

    return metadata;
  }

  async save(metadata) {
    await fs.access(this.archivePath(metadata.filename)); // Never describe an archive that is not in place

    const temporaryPath = `${this.metadataPath}${TEMPORARY_SUFFIX}`;

    await fs.writeFile(temporaryPath, JSON.stringify(metadata, null, 2));
    await fs.rename(temporaryPath, this.metadataPath); // Readers see either the previous or the new metadata, never a partial file
  }

  async removePreviousArchives() {
    const metadata = await this.findLatest();

    if (!metadata) {
      return;
    }

    await this.#removeArchivesExcept(metadata.filename);
  }

  async #removeArchivesExcept(filename) {
    const entries = await fs.readdir(this.path);
    const isArchiveOrLeftover = entry => entry.endsWith(ARCHIVE_EXTENSION) || entry.endsWith(`${ARCHIVE_EXTENSION}${TEMPORARY_SUFFIX}`); // Cleanup is restricted to archives and their leftovers: the storage path is user-provided and may hold unrelated files

    await Promise.all(entries
      .filter(entry => entry !== filename && isArchiveOrLeftover(entry))
      .map(entry => fs.rm(this.archivePath(entry), { force: true })));
  }
}
