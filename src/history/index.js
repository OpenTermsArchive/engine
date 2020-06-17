import { persist } from './persistor.js';
export { pushChanges } from './git.js';

export async function persistRaw(serviceProviderId, policyType, fileContent) {
  return persist({
    serviceProviderId,
    policyType,
    fileContent,
    isSanitized: false
  });
}

export async function persistSanitized(serviceProviderId, policyType, fileContent, relatedRawCommitSha) {
  return persist({
    serviceProviderId,
    policyType,
    fileContent,
    relatedRawCommitSha,
    isSanitized: true
  });
}
