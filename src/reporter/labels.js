export const DEPRECATED_MANAGED_BY_OTA_MARKER = '[managed by OTA]';

export const MANAGED_BY_OTA_MARKER = '- Auto-managed by OTA engine';

export const LABELS = {
  DNS_LOOKUP_FAILURE: {
    name: 'domain lookup failed',
    color: 'FFFFFF',
    description: 'Fetching failed because the request to DNS servers timed out',
  },
  DNS_RESOLUTION_FAILURE: {
    name: 'domain resolution failed',
    color: 'FFFFFF',
    description: 'Fetching failed because the domain name failed to resolve',
  },
  DOCUMENT_LOAD_TIMEOUT: {
    name: 'document load timed out',
    color: 'FFFFFF',
    description: 'Fetching failed with a timeout error',
  },
  DOCUMENT_NOT_FOUND: {
    name: 'document not found',
    color: 'FFFFFF',
    description: 'Fetch location is outdated',
  },
  DOCUMENT_STRUCTURE_CHANGE: {
    name: 'document structure changed',
    color: 'FFFFFF',
    description: 'Selectors do not match any content in the document',
  },
  EMPTY_CONTENT: {
    name: 'document was empty',
    color: 'FFFFFF',
    description: 'Fetching failed because the server returns an empty content',
  },
  EMPTY_RESPONSE: {
    name: 'received empty response',
    color: 'FFFFFF',
    description: 'Fetching failed because server returned an empty response body',
  },
  HTTP_403: {
    name: 'document access forbidden',
    color: 'FFFFFF',
    description: 'Fetching failed with a 403 (forbidden) HTTP code',
  },
  HTTP_429: {
    name: 'access limit exceeded',
    color: 'FFFFFF',
    description: 'Fetching failed with a 429 (too many requests) HTTP code',
  },
  HTTP_500: {
    name: 'server errored',
    color: 'FFFFFF',
    description: 'Fetching failed with a 500 (internal server error) HTTP code',
  },
  HTTP_502: {
    name: 'upstream server errored',
    color: 'FFFFFF',
    description: 'Fetching failed with a 502 (bad gateway) HTTP code',
  },
  HTTP_503: {
    name: 'server was unavailable',
    color: 'FFFFFF',
    description: 'Fetching failed with a 503 (service unavailable) HTTP code',
  },
  INVALID_SELECTOR: {
    name: 'invalid selector',
    color: 'FFFFFF',
    description: 'Some selectors cannot be understood by the engine',
  },
  SSL_EXPIRED: {
    name: 'certificate expired',
    color: 'FFFFFF',
    description: 'Fetching failed because the domain SSL certificate has expired',
  },
  SSL_INVALID: {
    name: 'certificate was invalid',
    color: 'FFFFFF',
    description: 'Fetching failed because the domain SSL certificate failed to verify',
  },
  TOO_MANY_REDIRECTS: {
    name: 'redirected too many times',
    color: 'FFFFFF',
    description: 'Fetching failed because of too many redirects',
  },
  UNKNOWN_FAILURE: {
    name: 'failed for an unknown reason',
    color: 'FFFFFF',
    description: 'Fetching failed for an undetermined reason that needs investigation',
  },
  NEEDS_INTERVENTION: {
    name: '⚠ needs intervention',
    color: 'FDD42A',
    description: 'Requires contributors intervention to restore tracking',
  },
};
