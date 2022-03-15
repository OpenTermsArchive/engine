import { release } from './index.js';

const RELEASE_HOURS_INTERVAL = 24;

const args = process.argv.slice(2);
const argsWithoutOptions = args.filter(arg => !arg.startsWith('--'));
const [fileName] = argsWithoutOptions;
const shouldSchedule = args.includes('--schedule');

const options = {
  fileName,
  shouldPublish: args.includes('--publish'),
  shouldRemoveLocalCopy: args.includes('--remove-local-copy'),
};

if (!shouldSchedule) {
  release(options);
} else {
  setInterval(release, RELEASE_HOURS_INTERVAL * 60 * 60 * 1000, options);
}
