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

function buildAbsoluteBaseUrl(req) {
  const host = req.get('X-Forwarded-Host') ?? req.get('host'); // Behind a trusted reverse proxy, the public host comes from X-Forwarded-Host. req.get('host') only sees the internal Host header, so we read the forwarded value explicitly and fall back to the direct host for non-proxied setups (dev, tests).

  return `${req.protocol}://${host}${req.baseUrl}`;
}

function classifyRecordType(version) {
  return version.isFirstRecord ? RECORD_TYPES.firstRecord : RECORD_TYPES.change;
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

function buildSchemes() {
  return {
    service: `tag:${TAG_AUTHORITY}:scheme:service`,
    termsType: `tag:${TAG_AUTHORITY}:scheme:terms-type`,
    recordType: `tag:${TAG_AUTHORITY}:scheme:record-type`,
  };
}

function buildEntry(storageType, versionUrlTemplate, baseUrl, collection, version) {
  const href = versionUrlTemplate?.replace('%VERSION_ID', version.id) ?? buildVersionLink(baseUrl, version);
  const schemes = buildSchemes();

  return {
    id: { _text: buildEntryId(storageType, collection, version) },
    link: { _attributes: { rel: 'alternate', type: 'text/html', href } },
    title: { _text: version.displayTitle },
    updated: { _text: version.fetchDate.toISOString() },
    category: [
      { _attributes: { term: version.serviceId, scheme: schemes.service } },
      { _attributes: { term: version.termsType, scheme: schemes.termsType } },
      { _attributes: { term: classifyRecordType(version), scheme: schemes.recordType } },
    ],
  };
}

function buildFeedDocument({ storageType, versionUrlTemplate, collection, selfHref, feedId, versions, baseUrl }) {
  const latestFetchDate = versions.length > 0 ? versions[0].fetchDate : new Date();

  const feed = {
    _attributes: { xmlns: 'http://www.w3.org/2005/Atom' },
    title: { _text: collection.metadata?.name || '' },
    subtitle: { _text: collection.metadata?.tagline || '' },
    id: { _text: feedId },
    updated: { _text: latestFetchDate.toISOString() },
    link: { _attributes: { rel: 'self', href: selfHref } },
    author: { name: { _text: FEED_AUTHOR_NAME } },
  };

  if (collection.metadata?.logo) {
    feed.logo = { _text: collection.metadata.logo };
  }

  feed.entry = versions.map(version => buildEntry(storageType, versionUrlTemplate, baseUrl, collection, version));

  return {
    _declaration: { _attributes: { version: '1.0', encoding: 'utf-8' } },
    feed,
  };
}

function sendFeed(res, opts) {
  const document = buildFeedDocument(opts);

  res.set('Content-Type', 'application/atom+xml; charset=utf-8');
  res.status(200).send(js2xml(document, { compact: true, spaces: 2 }));
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

    sendFeed(res, { storageType, versionUrlTemplate, collection, selfHref, feedId, versions, baseUrl });
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

    return sendFeed(res, { storageType, versionUrlTemplate, collection, selfHref, feedId, versions, baseUrl });
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

    return sendFeed(res, { storageType, versionUrlTemplate, collection, selfHref, feedId, versions, baseUrl });
  });

  return router;
}
