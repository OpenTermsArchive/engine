// PrivacyTests tracking-query set at dda473a462e5c37f9f2c8b2367fbc5f834796be4.
// Keep explicit filter parameters authoritative; this list applies only when a
// declaration enables removeQueryParams without configuration.
const DEFAULT_TRACKING_QUERY_PARAMS = Object.freeze([
  'fbclid',
  'gclid',
  'msclkid',
  'mc_eid',
  'dclid',
  'oly_anon_id',
  'oly_enc_id',
  '_openstat',
  'vero_conv',
  'vero_id',
  'wickedid',
  'yclid',
  '__s',
  'rb_clickid',
  's_cid',
  'ml_subscriber',
  'ml_subscriber_hash',
  '_hsenc',
  '__hssc',
  '__hstc',
  '__hsfp',
  'hsCtaTracking',
  'mkt_tok',
]);

export function removeQueryParams(webPageDOM, paramsToRemove = DEFAULT_TRACKING_QUERY_PARAMS) {
  const normalizedParams = Array.isArray(paramsToRemove) ? paramsToRemove : [paramsToRemove];

  if (!normalizedParams.length) {
    return;
  }

  const elements = webPageDOM.querySelectorAll('a[href], img[src]');

  for (const element of elements) {
    try {
      const urlString = element.href || element.src;
      const url = new URL(urlString);

      const hasTargetParams = normalizedParams.some(param => url.searchParams.has(param));

      if (hasTargetParams) {
        normalizedParams.forEach(param => url.searchParams.delete(param));

        const attributeName = element.tagName === 'A' ? 'href' : 'src';

        element[attributeName] = url.toString();
      }
    } catch {
      // Silently ignore invalid URLs
    }
  }
}

const SPACE_SEPARATORS = /\p{Zs}/gu;

export function convertSpacesToStandard(webPageDOM) {
  const walker = webPageDOM.createTreeWalker(webPageDOM.body, webPageDOM.defaultView.NodeFilter.SHOW_TEXT);

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const original = node.nodeValue;
    const normalized = original.replace(SPACE_SEPARATORS, ' ');

    if (normalized !== original) {
      node.nodeValue = normalized;
    }
  }
}
