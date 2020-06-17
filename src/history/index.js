import { persist } from './persistor.js';
export { pushChanges } from './git.js';

export async function persistRaw(serviceProviderId, policyType, fileContent) {
  return persist({
    serviceProviderId,
    policyType,
    fileContent
  });
}

export async function persistSanitized(serviceProviderId, policyType, fileContent, relatedRawCommitSha) {
  if (!relatedRawCommitSha) {
    throw new Error('A related raw commit SHA is required to ensure data consistency');
  }

  return persist({
    serviceProviderId,
    policyType,
    fileContent,
    relatedRawCommitSha
  });
}
