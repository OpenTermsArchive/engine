const DEFAULT_QUERY_PARAMS_TO_REMOVE = Object.freeze([ // Query parameters whose value varies while the linked resource stays the same
  // Campaign parameters, see https://en.wikipedia.org/wiki/UTM_parameters
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',

  // Click and user identifiers, see https://github.com/privacytests/privacytests/blob/dda473a462e5c37f9f2c8b2367fbc5f834796be4/live/results.js#L31-L65
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

  // Deployment identifiers, appended to assets URLs and renewed each time the website is deployed, see https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId
  'dpl',
]);

export function removeQueryParams(webPageDOM, paramsToRemove = DEFAULT_QUERY_PARAMS_TO_REMOVE) {
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
