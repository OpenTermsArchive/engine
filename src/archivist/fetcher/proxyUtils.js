export function resolveProxyConfiguration() {
  let httpProxy = null;
  let httpsProxy = null;

  if (process.env.http_proxy) {
    httpProxy = process.env.http_proxy;
  } else if (process.env.HTTP_PROXY) {
    httpProxy = process.env.HTTP_PROXY;
  }

  if (process.env.https_proxy) {
    httpsProxy = process.env.https_proxy;
  } else if (process.env.HTTPS_PROXY) {
    httpsProxy = process.env.HTTPS_PROXY;
  } else if (httpProxy) {
    httpsProxy = httpProxy;
  }

  return { httpProxy, httpsProxy };
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
