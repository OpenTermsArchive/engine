import simpleGit from 'simple-git';

const filePathToServiceId = filePath => filePath
  .replace('declarations/', '')
  .replace('.history', '')
  .replace('.filters', '')
  .replace('.json', '');

const getModifiedData = async instancePath => {
  const git = simpleGit(instancePath, { maxConcurrentProcesses: 1 });

  const modifiedFilePaths = (await git.diff([ '--name-only', 'HEAD', 'main', '--', './declarations' ])).trim().split('\n');

  return { git, modifiedFilePaths, modifiedServiceIds: new Set(modifiedFilePaths.map(filePathToServiceId)) };
};

export const getModifiedServices = async instancePath => {
  const { modifiedServiceIds } = await getModifiedData(instancePath);

  return modifiedServiceIds;
};
