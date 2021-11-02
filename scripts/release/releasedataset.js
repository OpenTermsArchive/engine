import { execSync } from 'child_process';

import config from 'config';

export async function publishRelease() {
  const result = execSync(`sh ./scripts/release/build_release.sh ${config.get('history.versionsPath')}`, { stdio: 'inherit' });

  return result;
}
