import fs from 'fs';

import config from 'config';
import inquirer from 'inquirer';
import shell from 'shelljs';

const DATA_REPO = `https://github.com/ambanum/CGUs-data.git`;

(async () => {
  try {
    if (fs.existsSync(config.get('history.dataPath'))) {
      return console.log(`It's seems that the database is already initialized as "${config.get('history.dataPath')}" directory already exists.`);
    }

    const newHistoryMessage = 'Start a new local fresh history';
    const downloadHistoryMessage = `Download the entire history of terms of services from ${DATA_REPO}`;
    const answer = await inquirer.prompt([{
      type: 'list',
      message: 'Choose an option to set up the database:',
      name: 'history',
      choices: [
        { name: newHistoryMessage },
        { name: downloadHistoryMessage }
      ]
    }]);

    if (answer.history === newHistoryMessage) {
      shell.mkdir(config.get('history.dataPath'));
      shell.cd(config.get('history.dataPath'));
      shell.exec('git init');
    } else {
      shell.exec(`git clone ${DATA_REPO} ${config.get('history.dataPath')}`);
    }

    console.log('Database initialized.')
  } catch (e) {
    console.log(e);
  }
})();
