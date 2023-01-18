import fsApi from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const fs = fsApi.promises;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let renamingRules;

export async function loadRules() {
  renamingRules = {
    serviceNames: JSON.parse(await fs.readFile(path.resolve(__dirname, './rules/serviceNames.json'))),
    termsTypes: JSON.parse(await fs.readFile(path.resolve(__dirname, './rules/termsTypes.json'))),
    termsTypesByService: JSON.parse(await fs.readFile(path.resolve(__dirname, './rules/termsTypesByService.json'))),
  };
}

export function applyRules(serviceId, termsType) {
  const renamedServiceId = renamingRules.serviceNames[serviceId];

  if (renamedServiceId) {
    console.log(`⌙ Rename service "${serviceId}" to "${renamedServiceId}"`);
    serviceId = renamedServiceId;
  }

  const renamedDocumentType = renamingRules.termsTypes[termsType];

  if (renamedDocumentType) {
    console.log(`⌙ Rename terms type "${termsType}" to "${renamedDocumentType}" of "${serviceId}" service`);
    termsType = renamedDocumentType;
  }

  const renamedServiceDocumentType = renamingRules.termsTypesByService[serviceId]
    && renamingRules.termsTypesByService[serviceId][termsType];

  if (renamedServiceDocumentType) {
    console.log(`⌙ Specific rename terms type "${termsType}" to "${renamedServiceDocumentType}" of "${serviceId}" service`);
    termsType = renamedServiceDocumentType;
  }

  return {
    serviceId,
    termsType,
  };
}
