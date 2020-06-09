import schedule from 'node-schedule';

import { updateTerms } from './src/index.js'

const rule = new schedule.RecurrenceRule();
rule.minute = 30; // every hour at 30 minutes after the hour

console.log('The scheduler is running…');

schedule.scheduleJob(rule, updateTerms);
