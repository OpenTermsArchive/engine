export const DEPRECATED_MANAGED_BY_OTA_MARKER = '[managed by OTA]';

export const MANAGED_BY_OTA_MARKER = '- Auto-managed by OTA engine';

export const LABELS = {
  HTTP_403: {
    name: 'page access restriction',
    color: 'FFFFFF',
    description: 'Fetching failed with a 403 (forbidden) HTTP code',
  },
  HTTP_429: {
    name: 'request limit exceeded',
    color: 'FFFFFF',
    description: 'Fetching failed with a 429 (too many requests) HTTP code',
  },
  HTTP_500: {
    name: 'server error',
    color: 'FFFFFF',
    description: 'Fetching failed with a 500 (internal server error) HTTP code',
  },
  HTTP_502: {
    name: 'server response failure',
    color: 'FFFFFF',
    description: 'Fetching failed with a 502 (bad gateway) HTTP code',
  },
  HTTP_503: {
    name: 'server unavailability',
    color: 'FFFFFF',
    description: 'Fetching failed with a 503 (service unavailable) HTTP code',
  },
  SSL_EXPIRED: {
    name: 'SSL certificate expiration',
    color: 'FFFFFF',
    description: 'Fetching failed because the domain SSL certificate has expired',
  },
  DNS_LOOKUP_FAILURE: {
    name: 'DNS lookup failure',
    color: 'FFFFFF',
    description: 'Fetching failed because the domain temporarily failed to resolve on DNS',
  },
  DNS_RESOLUTION_FAILURE: {
    name: 'DNS resolution failure',
    color: 'FFFFFF',
    description: 'Fetching failed because the domain fails to resolve on DNS',
  },
  EMPTY_RESPONSE: {
    name: 'empty response',
    color: 'FFFFFF',
    description: 'Fetching failed because server returned an empty response body',
  },
  SSL_INVALID: {
    name: 'SSL certificate invalidity',
    color: 'FFFFFF',
    description: 'Fetching failed because SSL certificate verification failed',
  },
  TOO_MANY_REDIRECTS: {
    name: 'too many redirects',
    color: 'FFFFFF',
    description: 'Fetching failed because too many redirects detected',
  },
  PAGE_LOAD_TIMEOUT: {
    name: 'page load timeout',
    color: 'FFFFFF',
    description: 'Fetching failed with a timeout error',
  },
  EMPTY_CONTENT: {
    name: 'empty content',
    color: 'FFFFFF',
    description: 'Fetching failed because the server returns an empty content',
  },
  UNKNOWN_FAILURE: {
    name: 'unknown failure reason',
    color: 'FFFFFF',
    description: 'Fetching failed for an undetermined reason that needs investigation',
  },
  PAGE_STRUCTURE_CHANGE: {
    name: 'page structure change',
    color: 'FFFFFF',
    description: 'Extraction selectors are outdated',
  },
  PAGE_NOT_FOUND: {
    name: 'page not found',
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
