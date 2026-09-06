import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

import { expect } from 'chai';

describe('Declaration validation command', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const collectionPath = path.join(__dirname, 'fixtures', 'duplicate-collection');

  it('rejects duplicate source documents during schema-only validation', () => {
    const result = spawnSync(
      process.execPath,
      [ 'bin/ota.js', 'validate', 'declarations', '--schema-only' ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_CONFIG: JSON.stringify({ '@opentermsarchive/engine': { collectionPath } }),
          NODE_ENV: 'test',
        },
      },
    );

    expect(result.status).to.equal(1);
    expect(result.stdout + result.stderr).to.include('The same source document is declared more than once within the "Privacy Policy" combine: https://example.com/privacy');
  }).timeout(10000);
});
