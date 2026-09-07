export function buildAbsoluteBaseUrl(req) {
  const host = req.get('X-Forwarded-Host') ?? req.get('host'); // Behind a trusted reverse proxy, the public host comes from X-Forwarded-Host. req.get('host') only sees the internal Host header, so we read the forwarded value explicitly and fall back to the direct host for non-proxied setups (dev, tests).

  return `${req.protocol}://${host}${req.baseUrl}`;
}
