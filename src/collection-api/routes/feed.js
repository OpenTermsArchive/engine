import express from 'express';
import { js2xml } from 'xml-js';

import { getCollection } from '../../archivist/collection/index.js';
import { toISODateWithoutMilliseconds } from '../../archivist/utils/date.js';

const RECORD_TYPES = {
  firstRecord: 'First record',
  change: 'Change',
};

const TAG_AUTHORITY = 'opentermsarchive.org,2026'; // Tag URI authority (RFC 4151). The year fixes the scheme inception and must never change: it would invalidate every previously emitted feed and entry ID.
const FEED_AUTHOR_NAME = 'Open Terms Archive engine';

const SCHEMES = Object.freeze({
  service: `tag:${TAG_AUTHORITY}:scheme:service`,
  termsType: `tag:${TAG_AUTHORITY}:scheme:terms-type`,
  recordType: `tag:${TAG_AUTHORITY}:scheme:record-type`,
});

function buildAbsoluteBaseUrl(req) {
  const host = req.get('X-Forwarded-Host') ?? req.get('host'); // Behind a trusted reverse proxy, the public host comes from X-Forwarded-Host. req.get('host') only sees the internal Host header, so we read the forwarded value explicitly and fall back to the direct host for non-proxied setups (dev, tests).

  return `${req.protocol}://${host}${req.baseUrl}`;
}

function classifyRecordType(version) {
  return version.isFirstRecord ? RECORD_TYPES.firstRecord : RECORD_TYPES.change;
}

// xml-js does not escape attribute values by default — callers are expected to pre-escape. We wire this helper to js2xml's attributeValueFn so every emitted attribute goes through it, regardless of where it's built. Without this, a serviceId like "AT&T Mobile" would yield malformed XML rejected by strict feed readers (libxml2-based).
function escapeXmlAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildVersionLink(baseUrl, version) {
  const encodedDate = encodeURIComponent(toISODateWithoutMilliseconds(version.fetchDate));
  const encodedService = encodeURIComponent(version.serviceId);
  const encodedTermsType = encodeURIComponent(version.termsType);

  return `${baseUrl}/version/${encodedService}/${encodedTermsType}/${encodedDate}`;
}

function buildEntryId(storageType, collection, version) {
  return `tag:${TAG_AUTHORITY}:version:${collection.metadata?.id}:${storageType}:${version.id}`;
}

function buildFeedId(collection, ...suffix) {
  return [ `tag:${TAG_AUTHORITY}:feed`, collection.metadata?.id, ...suffix ].join(':');
}

function buildEntry(storageType, versionUrlTemplate, baseUrl, collection, version) {
  const href = versionUrlTemplate?.replace('%VERSION_ID', version.id) ?? buildVersionLink(baseUrl, version);
  const type = versionUrlTemplate ? 'text/html' : 'application/json'; // The default link points to the JSON Version API; operators who configure a versionUrlTemplate typically target a human-readable page (e.g. a GitHub commit), which is HTML.

  return {
    id: { _text: buildEntryId(storageType, collection, version) },
    link: { _attributes: { rel: 'alternate', type, href } },
    title: { _text: version.displayTitle },
    updated: { _text: version.fetchDate.toISOString() },
    category: [
      { _attributes: { term: version.serviceId, scheme: SCHEMES.service } },
      { _attributes: { term: version.termsType, scheme: SCHEMES.termsType } },
      { _attributes: { term: classifyRecordType(version), scheme: SCHEMES.recordType } },
    ],
  };
}

function computeLatestFetchDate(versions) {
  return versions.length > 0 ? versions[0].fetchDate : new Date(0); // Atom 1.0 requires a feed-level <updated>. When no entry exists yet, fall back to the Unix epoch so the value is stable across requests, emitting `new Date()` would defeat conditional GET caching for empty feeds.
}

function buildFeedDocument({ storageType, versionUrlTemplate, collection, selfHref, feedId, versions, baseUrl, latestFetchDate }) {
  const feed = {
    _attributes: { xmlns: 'http://www.w3.org/2005/Atom' },
    title: { _text: collection.metadata.name },
    id: { _text: feedId },
    updated: { _text: latestFetchDate.toISOString() },
    link: { _attributes: { rel: 'self', type: 'application/atom+xml', href: selfHref } },
    author: { name: { _text: FEED_AUTHOR_NAME } },
  };

  if (collection.metadata?.tagline) {
    feed.subtitle = { _text: collection.metadata.tagline };
  }

  if (collection.metadata?.logo) {
    feed.logo = { _text: collection.metadata.logo };
  }

  feed.entry = versions.map(version => buildEntry(storageType, versionUrlTemplate, baseUrl, collection, version));

  return {
    _declaration: { _attributes: { version: '1.0', encoding: 'utf-8' } },
    feed,
  };
}

function sendFeed(req, res, opts) {
  const latestFetchDate = computeLatestFetchDate(opts.versions);

  res.set('Last-Modified', latestFetchDate.toUTCString()); // Setting Last-Modified before checking req.fresh enables Express to compare it with If-Modified-Since and return 304 when nothing changed since the reader's last fetch; the headline optimisation for Atom feeds, which are typically polled every few minutes.

  if (req.fresh) {
    return res.status(304).end();
  }

  res.set('Content-Type', 'application/atom+xml; charset=utf-8');
  const document = buildFeedDocument({ ...opts, latestFetchDate });

  return res.status(200).send(js2xml(document, { compact: true, spaces: 2, attributeValueFn: escapeXmlAttribute }));
}

/**
 * @param   {object}         services             The services to be exposed by the API
 * @param   {object}         versionsRepository   The versions repository instance
 * @param   {string}         storageType          The storage type identifier of the versions repository
 * @param   {number}         feedLimit            Maximum number of entries returned by feed endpoints
 * @param   {string}         [versionUrlTemplate] Optional URL template with %VERSION_ID placeholder; when set, replaces the API link as each entry's alternate href
 * @returns {express.Router}                      The router instance
 * @swagger
 * tags:
 *   name: Feeds
 *   description: Atom feeds of version changes
 */
export default function feedRouter(services, versionsRepository, storageType, feedLimit, versionUrlTemplate) {
  const router = express.Router();

  /**
   * @swagger
   * /feed:
   *   get:
   *     summary: Atom feed of the latest version changes across the whole collection.
   *     tags: [Feeds]
   *     produces:
   *       - application/atom+xml
   *     responses:
   *       200:
   *         description: An Atom 1.0 feed listing the latest version records, newest first. The maximum number of entries is server-configured.
   *         content:
   *           application/atom+xml:
   *             schema:
   *               type: string
   */
  router.get('/feed', async (req, res) => {
    const collection = await getCollection();
    const baseUrl = buildAbsoluteBaseUrl(req);
    const selfHref = `${baseUrl}/feed`;
    const feedId = buildFeedId(collection);

    const versions = await versionsRepository.findAll({ limit: feedLimit, includeTechnicalUpgrades: false });

    sendFeed(req, res, { storageType, versionUrlTemplate, collection, selfHref, feedId, versions, baseUrl });
  });

  /**
   * @swagger
   * /feed/{serviceId}:
   *   get:
   *     summary: Atom feed of the latest version changes scoped to a single service.
   *     tags: [Feeds]
   *     produces:
   *       - application/atom+xml
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         description: The ID of the service.
   *         schema:
   *           type: string
   *         required: true
   *     responses:
   *       200:
   *         description: An Atom 1.0 feed listing the latest version records for the given service, newest first.
   *         content:
   *           application/atom+xml:
   *             schema:
   *               type: string
   *       404:
   *         description: No service matching the provided ID is found.
   */
  router.get('/feed/:serviceId', async (req, res) => {
    const service = Object.hasOwn(services, req.params.serviceId) ? services[req.params.serviceId] : null;

    if (!service) {
      return res.status(404).send('Service not found');
    }

    const collection = await getCollection();
    const baseUrl = buildAbsoluteBaseUrl(req);
    const selfHref = `${baseUrl}/feed/${encodeURIComponent(service.id)}`;
    const feedId = buildFeedId(collection, service.id);

    const versions = await versionsRepository.findByService(service.id, { limit: feedLimit, includeTechnicalUpgrades: false });

    return sendFeed(req, res, { storageType, versionUrlTemplate, collection, selfHref, feedId, versions, baseUrl });
  });

  /**
   * @swagger
   * /feed/{serviceId}/{termsType}:
   *   get:
   *     summary: Atom feed of the latest version changes scoped to a service and terms type.
   *     tags: [Feeds]
   *     produces:
   *       - application/atom+xml
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         description: The ID of the service.
   *         schema:
   *           type: string
   *         required: true
   *       - in: path
   *         name: termsType
   *         description: The terms type declared by the service (e.g. "Terms of Service", "Privacy Policy").
   *         schema:
   *           type: string
   *         required: true
   *     responses:
   *       200:
   *         description: An Atom 1.0 feed listing the latest version records for the given service and terms type, newest first.
   *         content:
   *           application/atom+xml:
   *             schema:
   *               type: string
   *       404:
   *         description: Either the service ID does not match any service or the terms type is not declared by that service.
   */
  router.get('/feed/:serviceId/:termsType', async (req, res) => {
    const service = Object.hasOwn(services, req.params.serviceId) ? services[req.params.serviceId] : null;

    if (!service) {
      return res.status(404).send('Service not found');
    }

    const { termsType } = req.params;

    if (!service.getTermsTypes().includes(termsType)) {
      return res.status(404).send('Terms type not found for this service');
    }

    const collection = await getCollection();
    const baseUrl = buildAbsoluteBaseUrl(req);
    const selfHref = `${baseUrl}/feed/${encodeURIComponent(service.id)}/${encodeURIComponent(termsType)}`;
    const feedId = buildFeedId(collection, service.id, termsType);

    const versions = await versionsRepository.findByServiceAndTermsType(service.id, termsType, { limit: feedLimit, includeTechnicalUpgrades: false });

    return sendFeed(req, res, { storageType, versionUrlTemplate, collection, selfHref, feedId, versions, baseUrl });
  });

  return router;
}
