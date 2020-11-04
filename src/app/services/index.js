import path from 'path';
import simpleGit from 'simple-git';

export default class Services {
  static async getIdsOfModified() {
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const rootPath = path.join(__dirname, '../../../');

    console.log(path.resolve('.', rootPath));
    const git = simpleGit(rootPath, { maxConcurrentProcesses: 1 });
    const committedFiles = await git.diff([ '--name-only', 'master...HEAD', '--', 'services/*.json' ]);
    const status = await git.status();
    const modifiedFiles = [
      ...status.not_added, // Files created but not already in staged area
      ...status.modified, // Files modified
      ...status.created, // Files created and in the staged area
      ...status.renamed.map(({ to }) => to), // Files renamed
      ...committedFiles.trim().split('\n') // Files committed
    ];

    return modifiedFiles
      .filter(fileName => fileName.match(/services.*\.json/))
      .map(filePath => path.basename(filePath, '.json'));
  }
}
