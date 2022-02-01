import fsApi from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const fs = fsApi.promises;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let renamingRules;

export async function loadRules() {
  renamingRules = {
    serviceNames: JSON.parse(await fs.readFile(path.resolve(__dirname, './rules/serviceNames.json'))),
    documentTypes: JSON.parse(await fs.readFile(path.resolve(__dirname, './rules/documentTypes.json'))),
    documentTypesByService: JSON.parse(await fs.readFile(path.resolve(__dirname, './rules/documentTypesByService.json'))),
  };
}

export function applyRules(serviceId, documentType) {
  const renamedServiceId = renamingRules.serviceNames[serviceId];

  if (renamedServiceId) {
    console.log(`⌙ Rename service "${serviceId}" to "${renamedServiceId}"`);
    serviceId = renamedServiceId;
  }

  const renamedDocumentType = renamingRules.documentTypes[documentType];

  if (renamedDocumentType) {
    console.log(`⌙ Rename document type "${documentType}" to "${renamedDocumentType}" of "${serviceId}" service`);
    documentType = renamedDocumentType;
  }

  const renamedServiceDocumentType = renamingRules.documentTypesByService[serviceId]
    && renamingRules.documentTypesByService[serviceId][documentType];

  if (renamedServiceDocumentType) {
    console.log(`⌙ Specific rename document type "${documentType}" to "${renamedServiceDocumentType}" of "${serviceId}" service`);
    documentType = renamedServiceDocumentType;
  }

  return {
    serviceId,
    documentType,
  };
}
