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

  return [].concat(renamedServiceId).map(renamedServiceId => {
    if (renamedServiceId) {
      console.log(`⌙ Rename service "${serviceId}" to "${renamedServiceId}"`);
      serviceId = renamedServiceId;
    }

    const renamedTermsType = renamingRules.termsTypes[termsType];

    if (renamedTermsType) {
      console.log(`⌙ Rename terms type "${termsType}" to "${renamedTermsType}" of "${serviceId}" service`);
      termsType = renamedTermsType;
    }

    const renamedServiceTermsType = renamingRules.termsTypesByService[serviceId]
      && renamingRules.termsTypesByService[serviceId][termsType];

    if (renamedServiceTermsType) {
      console.log(`⌙ Specific rename terms type "${termsType}" to "${renamedServiceTermsType}" of "${serviceId}" service`);
      termsType = renamedServiceTermsType;
    }

    return {
      serviceId,
      termsType,
    };
  });
}
