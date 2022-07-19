import startOpenTermsArchive from './start.js';

const args = process.argv.slice(2);
const refilterOnly = args.includes('--refilter-only');
const schedule = args.includes('--schedule');
const extraArgs = args.filter(arg => !arg.startsWith('--'));

startOpenTermsArchive({ services: extraArgs, schedule, refilterOnly });
