export function buildAbsoluteBaseUrl(req) {
  return `${req.protocol}://${req.host}${req.baseUrl}`;
}
