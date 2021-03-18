import { execSync } from 'child_process';

async function main() {
  const result = execSync('sh ./scripts/release/build_release.sh', { stdio: 'ignore' });
  return result;
}

(async () => {
  await main();
})();
