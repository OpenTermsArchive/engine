export function resolveProxyConfiguration() {
  const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY;
  const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY || httpProxy;

  return {
    httpProxy,
    httpsProxy
  };
}

export function extractProxyCredentials(httpProxy, httpsProxy) {
  if (!httpProxy) {
    return null;
  }

  const httpProxyUrl = new URL(httpProxy);
  const httpsProxyUrl = new URL(httpsProxy);

  const { username, password } = httpProxyUrl;

  if (!username || !password) {
    return null;
  }

  if (httpProxyUrl.username !== httpsProxyUrl.username || httpProxyUrl.password !== httpsProxyUrl.password) {
    throw new Error('Unsupported proxies specified, http and https proxy should have the same credentials.');
  }

  return { username, password };
}
