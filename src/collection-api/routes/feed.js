import express from 'express';
import { js2xml } from 'xml-js';

import { getCollection } from '../../archivist/collection/index.js';
import { COMMIT_MESSAGE_PREFIXES } from '../../archivist/recorder/repositories/git/dataMapper.js';
import { toISODateWithoutMilliseconds } from '../../archivist/utils/date.js';

const RECORD_TYPES = {
  firstRecord: 'First record',
  technicalUpgrade: 'Technical upgrade',
  change: 'Change',
};

function buildAbsoluteBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}${req.baseUrl}`;
}

function classifyRecordType(version) {
  switch (true) {
  case version.isFirstRecord:
    return RECORD_TYPES.firstRecord;
  case version.isTechnicalUpgrade:
    return RECORD_TYPES.technicalUpgrade;
  default:
    return RECORD_TYPES.change;
  }
}

function buildEntryTitle(version) {
  let prefix;

  switch (true) {
  case version.isFirstRecord:
    prefix = COMMIT_MESSAGE_PREFIXES.startTracking;
    break;
  case version.isTechnicalUpgrade:
    prefix = COMMIT_MESSAGE_PREFIXES.technicalUpgrade;
    break;
  default:
    prefix = COMMIT_MESSAGE_PREFIXES.update;
  }

  return `${prefix} ${version.serviceId} ${version.termsType}`;
}

function buildVersionLink(baseUrl, version) {
  const encodedDate = encodeURIComponent(toISODateWithoutMilliseconds(version.fetchDate));
  const encodedService = encodeURIComponent(version.serviceId);
  const encodedTermsType = encodeURIComponent(version.termsType);

  return `${baseUrl}/version/${encodedService}/${encodedTermsType}/${encodedDate}`;
}

function buildEntryId(tagAuthority, storageType, collection, version) {
  return `tag:${tagAuthority}:version:${collection.metadata?.id}:${storageType}:${version.id}`;
}

function buildFeedId(tagAuthority, collection, ...suffix) {
  return [ `tag:${tagAuthority}:feed`, collection.metadata?.id, ...suffix ].join(':');
}

function buildEntry(tagAuthority, storageType, baseUrl, collection, version) {
  const apiLink = buildVersionLink(baseUrl, version);
  const githubCommitLink = collection.metadata?.versions && `${collection.metadata.versions}/commit/${version.id}`;

  const links = [{ _attributes: { rel: 'alternate', type: 'text/html', href: githubCommitLink || apiLink } }];

  if (githubCommitLink) {
    links.push({ _attributes: { rel: 'related', type: 'text/html', href: apiLink } });
  }

  return {
    id: { _text: buildEntryId(tagAuthority, storageType, collection, version) },
    link: links,
    title: { _text: buildEntryTitle(version) },
    updated: { _text: version.fetchDate.toISOString() },
    category: [
      { _attributes: { term: version.serviceId, scheme: `tag:${tagAuthority}:scheme:service` } },
      { _attributes: { term: version.termsType, scheme: `tag:${tagAuthority}:scheme:terms-type` } },
      { _attributes: { term: classifyRecordType(version), scheme: `tag:${tagAuthority}:scheme:record-type` } },
    ],
  };
}

function buildFeedDocument({ tagAuthority, storageType, feedAuthorName, collection, selfHref, feedId, versions, baseUrl }) {
  const latestFetchDate = versions.length > 0 ? versions[0].fetchDate : new Date();

  const feed = {
    _attributes: { xmlns: 'http://www.w3.org/2005/Atom' },
    title: { _text: collection.metadata?.name || '' },
    subtitle: { _text: collection.metadata?.tagline || '' },
    id: { _text: feedId },
    updated: { _text: latestFetchDate.toISOString() },
    link: { _attributes: { rel: 'self', href: selfHref } },
    author: { name: { _text: feedAuthorName } },
  };

  if (collection.metadata?.logo) {
    feed.logo = { _text: collection.metadata.logo };
  }

  feed.entry = versions.map(version => buildEntry(tagAuthority, storageType, baseUrl, collection, version));

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
 * @param   {object}         services           The services to be exposed by the API
 * @param   {object}         versionsRepository The versions repository instance
 * @param   {string}         storageType        The storage type identifier of the versions repository
 * @param   {number}         feedLimit          Maximum number of entries returned by feed endpoints
 * @param   {string}         feedAuthorName     Name used for the Atom feed-level author element
 * @param   {string}         tagAuthority       Tag URI authority used to mint feed and entry IDs (RFC 4151)
 * @returns {express.Router}                    The router instance
 * @swagger
 * tags:
 *   name: Feeds
 *   description: Atom feeds of version changes
 */
export default function feedRouter(services, versionsRepository, storageType, feedLimit, feedAuthorName, tagAuthority) {
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
    const feedId = buildFeedId(tagAuthority, collection);

    const versions = await versionsRepository.findAll({ limit: feedLimit });

    sendFeed(res, { tagAuthority, storageType, feedAuthorName, collection, selfHref, feedId, versions, baseUrl });
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
    const feedId = buildFeedId(tagAuthority, collection, service.id);

    const versions = await versionsRepository.findByService(service.id, { limit: feedLimit });

    return sendFeed(res, { tagAuthority, storageType, feedAuthorName, collection, selfHref, feedId, versions, baseUrl });
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
    const feedId = buildFeedId(tagAuthority, collection, service.id, termsType);

    const versions = await versionsRepository.findByServiceAndTermsType(service.id, termsType, { limit: feedLimit });

    return sendFeed(res, { tagAuthority, storageType, feedAuthorName, collection, selfHref, feedId, versions, baseUrl });
  });

  return router;
}
