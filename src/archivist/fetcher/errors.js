export class FetchDocumentError extends Error {
  static LIKELY_BOT_BLOCKING_ERRORS = [
    'HTTP code 403',
    'HTTP code 406',
    'HTTP code 502',
    'ECONNRESET',
  ];

  static LIKELY_TRANSIENT_ERRORS = [
    'EAI_AGAIN', // DNS lookup temporary failure - DNS server is temporarily unavailable or overloaded
    'ETIMEDOUT', // Connection timeout - network latency or server load issues
    'ERR_NAME_NOT_RESOLVED', // DNS lookup temporary failure - DNS server is temporarily unavailable or overloaded
    'HTTP code 500', // Internal Server Error - server encountered an error while processing the request
    'HTTP code 503', // Service Unavailable - server is temporarily overloaded or down for maintenance
    'HTTP code 504', // Gateway Timeout - upstream server took too long to respond, might be temporary
    ...FetchDocumentError.LIKELY_BOT_BLOCKING_ERRORS,
  ];

  constructor(message) {
    super(`Fetch failed: ${message}`);
    this.name = 'FetchDocumentError';
    this.mayBeTransient = FetchDocumentError.LIKELY_TRANSIENT_ERRORS.some(err => message.includes(err));
    this.mayBeBotBlocking = FetchDocumentError.LIKELY_BOT_BLOCKING_ERRORS.some(err => message.includes(err));
  }
}
