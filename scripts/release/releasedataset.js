import config from 'config';
import { execSync } from 'child_process';

async function main() {
  const result = execSync(`sh ./scripts/release/build_release.sh ${config.get('history.versionsPath')}`, { stdio: 'inherit' });
  return result;
}

(async () => {
  await main();
})();
