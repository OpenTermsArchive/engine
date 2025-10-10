import fs from 'fs/promises';
import path from 'path';

export const DECLARATIONS_PATH = './declarations';
const declarationsPath = path.resolve(process.cwd(), DECLARATIONS_PATH);

/**
 * Loads snapshots from service declarations.
 * Skips deleted/missing services.
 * Returns an array of service IDs that exist.
 */
export async function loadSnapshots() {
  try {
    const files = await fs.readdir(declarationsPath);
    
    // Filter only JSON files (service declarations)
    const snapshots = files
      .filter(file => file.endsWith('.json'))
      .map(file => path.basename(file, '.json'));
    
    return snapshots;
  } catch (err) {
    if (err.code === 'ENOENT') {
      // Declarations folder doesn't exist -> no snapshots
      return [];
    }
    throw err;
  }
}
