import { persist } from './history.js';

export async function persistRaw(serviceProviderId, policyType, fileContent) {
  return persist({
    serviceProviderId,
    policyType,
    fileContent,
    isSanitized: false
  });
}

export async function persistSanitized(serviceProviderId, policyType, fileContent) {
  return persist({
    serviceProviderId,
    policyType,
    fileContent,
    isSanitized: true
  });
}
