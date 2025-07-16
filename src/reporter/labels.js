export const DEPRECATED_MANAGED_BY_OTA_MARKER = '[managed by OTA]';

export const MANAGED_BY_OTA_MARKER = '- Auto-managed by OTA engine';

export const LABELS = {
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
  SSL_EXPIRED: {
    name: 'certificate expired',
    color: 'FFFFFF',
    description: 'Fetching failed because the domain SSL certificate has expired',
  },
  DNS_LOOKUP_FAILURE: {
    name: 'domain lookup failed',
    color: 'FFFFFF',
    description: 'Fetching failed because the domain temporarily failed to resolve on DNS',
  },
  DNS_RESOLUTION_FAILURE: {
    name: 'domain resolution failed',
    color: 'FFFFFF',
    description: 'Fetching failed because the domain fails to resolve on DNS',
  },
  EMPTY_RESPONSE: {
    name: 'received empty response',
    color: 'FFFFFF',
    description: 'Fetching failed because server returned an empty response body',
  },
  SSL_INVALID: {
    name: 'certificate was invalid',
    color: 'FFFFFF',
    description: 'Fetching failed because SSL certificate verification failed',
  },
  TOO_MANY_REDIRECTS: {
    name: 'redirected too many times',
    color: 'FFFFFF',
    description: 'Fetching failed because of too many redirects',
  },
  DOCUMENT_LOAD_TIMEOUT: {
    name: 'document load timed out',
    color: 'FFFFFF',
    description: 'Fetching failed with a timeout error',
  },
  EMPTY_CONTENT: {
    name: 'document was empty',
    color: 'FFFFFF',
    description: 'Fetching failed because the server returns an empty content',
  },
  UNKNOWN_FAILURE: {
    name: 'failed for unknown reason',
    color: 'FFFFFF',
    description: 'Fetching failed for an undetermined reason that needs investigation',
  },
  DOCUMENT_STRUCTURE_CHANGE: {
    name: 'document structure changed',
    color: 'FFFFFF',
    description: 'Extraction selectors are outdated',
  },
  DOCUMENT_NOT_FOUND: {
    name: 'document not found',
    color: 'FFFFFF',
    description: 'Fetch location is outdated',
  },
  INVALID_SELECTOR: {
    name: 'invalid selector',
    color: 'FFFFFF',
    description: 'Some selectors cannot be understood by the engine',
  },
  NEEDS_INTERVENTION: {
    name: '⚠ needs intervention',
    color: 'FDD42A',
    description: 'Requires contributors intervention to restore tracking',
  },
};
