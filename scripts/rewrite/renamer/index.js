import { fileURLToPath } from 'url';
import fsApi from 'fs';
import path from 'path';

const fs = fsApi.promises;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let renamingRules;

export async function loadRules() {
  renamingRules = {
    services: JSON.parse(await fs.readFile(path.resolve(__dirname, './rules/services.json'))),
    documentTypes: JSON.parse(
      await fs.readFile(path.resolve(__dirname, './rules/documentTypes.json'))
    ),
    servicesDocumentTypes: JSON.parse(
      await fs.readFile(path.resolve(__dirname, './rules/servicesDocumentTypes.json'))
    ),
  };
}

export function applyRules(serviceId, documentType) {
  const renamedServiceId = renamingRules.services[serviceId];
  if (renamedServiceId) {
    console.log(`⌙ Rename service "${serviceId}" to "${renamedServiceId}"`);
    serviceId = renamedServiceId;
  }

  const renamedDocumentType = renamingRules.documentTypes[documentType];
  if (renamedDocumentType) {
    console.log(
      `⌙ Rename document type "${documentType}" to "${renamedDocumentType}" of "${serviceId}" service`
    );
    documentType = renamedDocumentType;
  }

  const renamedServiceDocumentType = renamingRules.servicesDocumentTypes[serviceId]
    && renamingRules.servicesDocumentTypes[serviceId][documentType];
  if (renamedServiceDocumentType) {
    console.log(
      `⌙ Specific rename document type "${documentType}" to "${renamedServiceDocumentType}" of "${serviceId}" service`
    );
    documentType = renamedServiceDocumentType;
  }

  return {
    serviceId,
    documentType,
  };
}
