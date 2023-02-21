import path from 'path';

import DeepDiff from 'deep-diff';
import simpleGit from 'simple-git';

export default class DeclarationUtils {
  constructor(instancePath, defaultBranch = 'remotes/origin/main') {
    this.git = simpleGit(instancePath, { maxConcurrentProcesses: 1 });
    this.defaultBranch = defaultBranch;
  }

  static filePathToServiceId = filePath => path.parse(filePath.replace(/\.history|\.filters/, '')).name;

  async getJSONFile(path, ref) {
    try {
      return JSON.parse(await this.git.show([`${ref}:${path}`]));
    } catch (e) {
      return {};
    }
  }

  async getModifiedData() {
    const modifiedFilePathsAsString = (await this.git.diff([ '--diff-filter=d', '--name-only', this.defaultBranch, 'HEAD', '--', './declarations' ])).trim();

    const modifiedFilePaths = modifiedFilePathsAsString ? modifiedFilePathsAsString.split('\n') : [];

    return { modifiedFilePaths, modifiedServiceIds: Array.from(new Set(modifiedFilePaths.map(DeclarationUtils.filePathToServiceId))) };
  }

  async getModifiedServices() {
    const { modifiedServiceIds } = await this.getModifiedData();

    return modifiedServiceIds;
  }

  async getModifiedServiceTermsTypes() {
    const { modifiedFilePaths, modifiedServiceIds } = await this.getModifiedData();
    const servicesTermsTypes = {};

    await Promise.all(modifiedFilePaths.map(async modifiedFilePath => {
      const serviceId = DeclarationUtils.filePathToServiceId(modifiedFilePath);

      if (!modifiedFilePath.endsWith('.json')) {
        // Here we should compare AST of both files to detect on which function
        // change has been made, and then find which terms type depends on this
        // function.
        // As this is a complicated process, we will just send back all terms types
        const declaration = await this.getJSONFile(`declarations/${serviceId}.json`, this.defaultBranch);

        return Object.keys(declaration.documents);
      }

      const defaultFile = await this.getJSONFile(modifiedFilePath, this.defaultBranch);
      const modifiedFile = await this.getJSONFile(modifiedFilePath, 'HEAD');

      const diff = DeepDiff.diff(defaultFile, modifiedFile);

      if (!diff) {
        // This can happen if only a lint has been applied to a document
        return;
      }

      const modifiedTermsTypes = diff.reduce((acc, { path }) => {
        if (modifiedFilePath.includes('.history')) {
          acc.add(path[0]);
        } else if (path[0] == 'documents') {
          acc.add(path[1]);
        }

        return acc;
      }, new Set());

      servicesTermsTypes[serviceId] = Array.from(new Set([ ...servicesTermsTypes[serviceId] || [], ...modifiedTermsTypes ]));
    }));

    return {
      services: modifiedServiceIds,
      servicesTermsTypes,
    };
  }
}
