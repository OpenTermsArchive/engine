// Depending on the fetcher used, these codes are found either in error.code or error.message
export const ErrorCodes = [
  'EAI_AGAIN', // Network Error
  'ECONNRESET', // Network Error
  'ENOTFOUND', // Network Error
  'ERR_FAILED', // Network Error
  'ERR_INVALID_PROTOCOL', // Network Error
  'ERR_NAME_NOT_RESOLVED', // Network Error
  'ERR_TUNNEL_CONNECTION_FAILED', // Network Error
  'ETIMEDOUT', // Network Error
  'CERT_HAS_EXPIRED', // Certificate Error
  'DEPTH_ZERO_SELF_SIGNED_CERT', // Certificate Error
  'ERR_CERT_AUTHORITY_INVALID', // Certificate Error
  'ERR_CERT_DATE_INVALID', // Certificate Error
  'ERR_TLS_CERT_ALTNAME_INVALID', // Certificate Error
  'SELF_SIGNED_CERT_IN_CHAIN', // Certificate Error
];
