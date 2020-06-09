import schedule from 'node-schedule';

import { updateTerms } from './src/index.js'

const rule = new schedule.RecurrenceRule();
rule.minute = 30; // at minute 30 past every hour.

console.log('The scheduler is running…');
console.log('Jobs will run at minute 30 past every hour.');

schedule.scheduleJob(rule, updateTerms);
