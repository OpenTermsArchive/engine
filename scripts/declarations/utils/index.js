import path from 'path';

import DeepDiff from 'deep-diff';
import simpleGit from 'simple-git';

const filePathToServiceId = filePath => path.parse(filePath.replace(/\.history|\.filters/, '')).name;

const getModifiedData = async instancePath => {
  const git = simpleGit(instancePath, { maxConcurrentProcesses: 1 });

  const modifiedFilePathsAsString = (await git.diff([ '--name-only', 'HEAD', 'main', '--', './declarations' ])).trim();

  const modifiedFilePaths = modifiedFilePathsAsString ? modifiedFilePathsAsString.split('\n') : [];

  return { git, modifiedFilePaths, modifiedServiceIds: new Set(modifiedFilePaths.map(filePathToServiceId)) };
};

export const getModifiedServices = async instancePath => {
  const { modifiedServiceIds } = await getModifiedData(instancePath);

  return modifiedServiceIds;
};

const getJSONFile = async (git, path, ref) => {
  try {
    return JSON.parse(await git.show([`${ref}:${path}`]));
  } catch (e) {
    return {};
  }
};

export const getModifiedServiceDocumentTypes = async instancePath => {
  const { git, modifiedFilePaths, modifiedServiceIds } = await getModifiedData(instancePath);
  const defaultBranch = 'main'; // could be retrieved from git
  const servicesDocumentTypes = {};

  await Promise.all(modifiedFilePaths.map(async modifiedFilePath => {
    const serviceId = filePathToServiceId(modifiedFilePath);

    if (!modifiedFilePath.endsWith('.json')) {
      // here we should compare AST of both files to detect on which function
      // change has been made, and then find which document type depends on this
      // function.
      // As this is a complicated process, we will just send back all document types
      const declaration = JSON.parse(await git.show([`${defaultBranch}:declarations/${serviceId}.json`]));

      return Object.keys(declaration.documents);
    }

    const defaultFile = await getJSONFile(git, modifiedFilePath, defaultBranch);
    const modifiedFile = await getJSONFile(git, modifiedFilePath, 'HEAD');

    const diff = DeepDiff.diff(defaultFile, modifiedFile);

    if (!diff) {
      // This can happen if only a lint has been applied to a document
      return;
    }

    const modifiedDocumentTypes = diff.reduce((acc, { path }) => {
      if (modifiedFilePath.includes('.history')) {
        acc.add(path[0]);
      } else if (path[0] == 'documents') {
        acc.add(path[1]);
      }

      return acc;
    }, new Set());

    servicesDocumentTypes[serviceId] = new Set([ ...servicesDocumentTypes[serviceId] || [], ...modifiedDocumentTypes ]);
  }));

  return { services: modifiedServiceIds, servicesDocumentTypes };
};
