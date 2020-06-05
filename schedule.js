import schedule from 'node-schedule';
import childProcess from 'child_process';

const rule = new schedule.RecurrenceRule();
rule.minute = 30; // every hour at 30 minutes after the hour

console.log('The scheduler is running…');

schedule.scheduleJob(rule, function(){
  console.log('Start scheduled job:');

  const forkedProcess = childProcess.fork('./index.js');

  forkedProcess.on('error', function (err) {
    console.log(err);
  });

  forkedProcess.on('exit', function (code) {
    console.log('Done!');
  });
});
