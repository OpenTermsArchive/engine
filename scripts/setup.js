import fs from 'fs';
import path from 'path';

import config from 'config';
import inquirer from 'inquirer';
import simpleGit from 'simple-git';
import shell from 'shelljs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const dataRepositoryUrl = `https://github.com/ambanum/CGUs-data.git`;

(async () => {
  try {
    if (fs.existsSync(config.get('history.dataPath'))) {
      return console.log(`It's seems that the database is already initialized as the "${config.get('history.dataPath')}" directory already exists. Erase that folder first if you’d like to set up a new database.`);
    }

    const newHistoryMessage = 'Start a new local empty history';
    const downloadHistoryMessage = `Download the entire history of terms of services from ${dataRepositoryUrl}`;
    const answer = await inquirer.prompt([{
      type: 'list',
      message: 'How would you like to set up the database?',
      name: 'history',
      choices: [
        { name: newHistoryMessage },
        { name: downloadHistoryMessage }
      ]
    }]);

    if (answer.history === newHistoryMessage) {
      shell.mkdir(config.get('history.dataPath'));
      shell.cd(config.get('history.dataPath'));
      const git = simpleGit(path.resolve(__dirname, '../', config.get('history.dataPath')));
      await git.init();
    } else {
      const git = simpleGit();
      await git.clone(dataRepositoryUrl, config.get('history.dataPath'));
    }

    console.log('Database initialized.')
  } catch (e) {
    console.log(e);
  }
})();
