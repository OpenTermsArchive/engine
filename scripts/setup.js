import fsApi from 'fs';
const fs = fsApi.promises;
import path from 'path';

import config from 'config';
import inquirer from 'inquirer';
import simpleGit from 'simple-git';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const NEW_HISTORY_MESSAGE = 'Start a new local empty history';
const DOWNLOAD_HISTORY_MESSAGE = `Download the entire history of terms of services from ${config.get('history.publicSnapshotsRepository')} and ${config.get('history.publicVersionsRepository')}`;

(async () => {
  try {
    if (fsApi.existsSync(config.get('history.versionsPath')) || fsApi.existsSync(config.get('history.snapshotsPath'))) {
      return console.log(`It seems that the database is already initialized as the "${config.get('history.versionsPath')}" or the "${config.get('history.snapshotsPath')}" directories already exist. Erase these folders first (or change the source path in the config) if you’d like to set up a new database.`);
    }

    const answer = await inquirer.prompt([{
      type: 'list',
      message: 'How would you like to set up the database?',
      name: 'history',
      choices: [
        { name: NEW_HISTORY_MESSAGE },
        { name: DOWNLOAD_HISTORY_MESSAGE }
      ]
    }]);

    if (answer.history === NEW_HISTORY_MESSAGE) {
      await fs.mkdir(config.get('history.snapshotsPath'), { recursive: true });
      await fs.mkdir(config.get('history.versionsPath'), { recursive: true });
      let git = simpleGit(path.resolve(__dirname, '../', config.get('history.snapshotsPath')));
      await git.init();
      git = simpleGit(path.resolve(__dirname, '../', config.get('history.versionsPath')));
      await git.init();
    } else {
      const git = simpleGit();
      await git.clone(config.get('history.publicVersionsRepository'), config.get('history.versionsPath'));
      await git.clone(config.get('history.publicSnapshotsRepository'), config.get('history.snapshotsPath'));
    }

    console.log('Database initialized.')
  } catch (e) {
    console.log(e);
  }
})();
