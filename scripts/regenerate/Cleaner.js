import fs from 'fs';
import path from 'path';

const DEFAULT_CONTENT = {
  documents: {},
  documentTypes: { },
};

export default class Cleaner {
  constructor(baseDir, filename = 'index.json') {
    this.baseDir = baseDir;
    this.filename = filename;
    this.filePath = path.join(baseDir, filename);
    fs.mkdir(baseDir, { recursive: true }, () => {
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, `${JSON.stringify(DEFAULT_CONTENT, null, 2)}\n`);
      }
    });
  }

  getRules() {
    if (!this.rules) {
      this.rules = JSON.parse(fs.readFileSync(this.filePath).toString());
    }

    return this.rules;
  }

  update(newRules) {
    this.rules = newRules;
    fs.writeFileSync(this.filePath, `${JSON.stringify(newRules, null, 2)}\n`);
  }

  updateDocument(serviceId, documentType, field, value) {
    const cleaningRules = this.getRules();
    const service = cleaningRules.documents[serviceId] || {};
    const document = service[documentType] || {};

    let updatedValue;

    if (field == 'skipContent') {
      updatedValue = { ...document[field] || {}, ...value };
    } else if ([ 'skipCommit', 'skipSelector', 'skipMissingSelector' ].includes(field)) {
      updatedValue = [ ...document[field] || [], value ];
    } else if (field == 'done') {
      updatedValue = value;
    }

    cleaningRules.documents = {
      ...cleaningRules.documents,
      [serviceId]: {
        ...service,
        [documentType]: {
          ...document,
          [field]: updatedValue,
        },
      },
    };
    // logger.debug(`${value} appended to ${field}`);
    this.update(cleaningRules);
  }

  getSnapshotIdsToSkip(serviceId, documentType) {
    const snapshotsIds = Object.entries(this.getRules().documents)
      .filter(([cleaningServiceId]) => [ '*', serviceId ].includes(cleaningServiceId))
      .map(([ , cleaningDocumentTypes ]) => Object.entries(cleaningDocumentTypes)
        .filter(([cleaningDocumentType]) => [ '*', documentType ].includes(cleaningDocumentType))
        .map(([ , { skipCommit }]) => skipCommit)
        .filter(skippedCommit => !!skippedCommit)
        .flat()).flat();

    return snapshotsIds;
  }

  getDocumentRules(serviceId, documentType) {
    const documentRules = (this.getRules().documents[serviceId] || {})[documentType];

    const contentsToSkip = (documentRules && documentRules.skipContent) || {};
    const selectorsToSkip = (documentRules && documentRules.skipSelector) || [];
    const missingRequiredSelectors = (documentRules && documentRules.skipIfMissingSelector) || [];

    return {
      contentsToSkip,
      selectorsToSkip,
      missingRequiredSelectors,
    };
  }

  getDocumentTypesRules() {
    return this.getRules().documentTypes || {};
  }

  isDocumentDone(serviceId, documentType) {
    const rules = this.getRules();

    return rules && rules.documents[serviceId] && rules.documents[serviceId][documentType] && rules.documents[serviceId][documentType].done;
  }
}
