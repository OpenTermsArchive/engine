import path from 'path';

import simpleGit from 'simple-git';

const SOURCE_DOCUMENT_PROPERTIES = [ 'fetch', 'select', 'remove', 'filter', 'executeClientScripts' ];

export default class DeclarationUtils {
  constructor(instancePath, defaultBranch = 'remotes/origin/main') {
    this.git = simpleGit(instancePath, { maxConcurrentProcesses: 1 });
    this.defaultBranch = defaultBranch;
  }

  static getServiceIdFromFilePath(filePath) {
    return path.parse(filePath.replace(/\.history|\.filters/g, '')).name;
  }

  static getSourceDocumentsDeclarations(termsDeclaration) {
    const sourceDocumentsDeclarations = termsDeclaration.combine || [{}];

    return Object.fromEntries(sourceDocumentsDeclarations.map(sourceDocumentDeclaration => {
      const declaration = Object.fromEntries(SOURCE_DOCUMENT_PROPERTIES.map(property => [ property, sourceDocumentDeclaration[property] ?? termsDeclaration[property] ])); // Mirror the inheritance of terms properties applied when loading the declaration, with keys in a fixed order so that serializations can be compared

      return [ declaration.fetch, JSON.stringify(declaration) ];
    }));
  }

  static getModifiedSourceDocuments(originalTermsDeclaration, modifiedTermsDeclaration) {
    const originalSourceDocuments = DeclarationUtils.getSourceDocumentsDeclarations(originalTermsDeclaration);
    const modifiedSourceDocuments = DeclarationUtils.getSourceDocumentsDeclarations(modifiedTermsDeclaration);

    return Object.keys(modifiedSourceDocuments).filter(location => originalSourceDocuments[location] !== modifiedSourceDocuments[location]);
  }

  async getJSONFromFile(ref, filePath) {
    try {
      const fileContent = await this.git.show([`${ref}:${filePath}`]);

      return JSON.parse(fileContent);
    } catch (error) {
      // the file does not exist on the requested branch or it is not parsable
    }
  }

  async getModifiedData() {
    const modifiedFilePathsAsString = (await this.git.diff([ '-z', '--diff-filter=d', '--name-only', this.defaultBranch, 'HEAD', '--', './declarations' ])).trim(); // -z option is required to avoid pathnames with "unusual" characters to be quoted, but it also replaces result separator by the  zero byte character \0

    const modifiedFilePaths = (modifiedFilePathsAsString ? modifiedFilePathsAsString.split('\0') : []).filter(str => str !== ''); // split on \0 rather than \n due to the -z option of git diff

    return { modifiedFilePaths, modifiedServicesIds: Array.from(new Set(modifiedFilePaths.map(DeclarationUtils.getServiceIdFromFilePath))) };
  }

  async getModifiedServices() {
    const { modifiedServicesIds } = await this.getModifiedData();

    return modifiedServicesIds;
  }

  async getModifiedServicesAndTermsTypes() {
    const { modifiedFilePaths } = await this.getModifiedData();
    const servicesTermsTypes = {};
    const servicesTermsSourceDocuments = {};
    const servicesWithModifiedFilters = new Set();

    await Promise.all(modifiedFilePaths.map(async modifiedFilePath => {
      const serviceId = DeclarationUtils.getServiceIdFromFilePath(modifiedFilePath);

      if (modifiedFilePath.endsWith('.history.json')) {
        return; // Assuming history modifications imply corresponding changes in the service declaration and that the analysis of which terms types of this service have changed will be done when analysing the related declaration, no further action is required here
      }

      if (modifiedFilePath.endsWith('.filters.js') || modifiedFilePath.endsWith('.filters.history.js')) {
        servicesWithModifiedFilters.add(serviceId);

        const declaration = await this.getJSONFromFile(this.defaultBranch, `declarations/${serviceId}.json`);

        if (!declaration) { // Happens when the file declaration exists in the branch but not in the default branch
          return;
        }

        servicesTermsTypes[serviceId] = Object.keys(declaration.terms); // Considering how rarely filters are used, simply return all term types that could potentially be impacted to spare implementing a function change check

        return;
      }

      const originalService = await this.getJSONFromFile(this.defaultBranch, modifiedFilePath);
      const modifiedService = await this.getJSONFromFile('HEAD', modifiedFilePath);
      const modifiedServiceTermsTypes = Object.keys(modifiedService.terms);

      if (!originalService) {
        servicesTermsTypes[serviceId] = modifiedServiceTermsTypes;

        return;
      }

      const originalServiceTermsTypes = Object.keys(originalService.terms);

      modifiedServiceTermsTypes.forEach(termsType => {
        const areTermsAdded = !originalServiceTermsTypes.includes(termsType);
        const areTermsModified = JSON.stringify(originalService.terms[termsType]) != JSON.stringify(modifiedService.terms[termsType]);

        if (!areTermsAdded && !areTermsModified) {
          return;
        }

        servicesTermsTypes[serviceId] = [termsType].concat(servicesTermsTypes[serviceId] || []);

        if (!areTermsAdded) {
          servicesTermsSourceDocuments[serviceId] = {
            ...servicesTermsSourceDocuments[serviceId],
            [termsType]: DeclarationUtils.getModifiedSourceDocuments(originalService.terms[termsType], modifiedService.terms[termsType]),
          };
        }
      });
    }));

    servicesWithModifiedFilters.forEach(serviceId => delete servicesTermsSourceDocuments[serviceId]); // A filter change can impact any source document of the service, whatever its declaration

    return {
      services: Object.keys(servicesTermsTypes),
      servicesTermsTypes,
      servicesTermsSourceDocuments,
    };
  }
}
