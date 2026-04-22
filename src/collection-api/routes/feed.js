import express from 'express';
import { js2xml } from 'xml-js';

import { getCollection } from '../../archivist/collection/index.js';
import { COMMIT_MESSAGE_PREFIXES } from '../../archivist/recorder/repositories/git/dataMapper.js';
import { toISODateWithoutMilliseconds } from '../../archivist/utils/date.js';

import versionsRepository, { storageConfig } from './versionsRepository.js';

const TAG_AUTHORITY = 'opentermsarchive.org,2026';
const FEED_AUTHOR_NAME = 'OTA-Bot';
const DEFAULT_LIMIT = 100;

const RECORD_TYPES = {
  firstRecord: 'First record',
  technicalUpgrade: 'Technical upgrade',
  change: 'Change',
};

const SCHEMES = {
  service: `tag:${TAG_AUTHORITY}:scheme:service`,
  termsType: `tag:${TAG_AUTHORITY}:scheme:terms-type`,
  recordType: `tag:${TAG_AUTHORITY}:scheme:record-type`,
};

function buildAbsoluteBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}${req.baseUrl}`;
}

function classifyRecordType(version) {
  if (version.isFirstRecord) return RECORD_TYPES.firstRecord;
  if (version.isTechnicalUpgrade) return RECORD_TYPES.technicalUpgrade;

  return RECORD_TYPES.change;
}

function buildEntryTitle(version) {
  let prefix = COMMIT_MESSAGE_PREFIXES.update;

  if (version.isFirstRecord) prefix = COMMIT_MESSAGE_PREFIXES.startTracking;
  else if (version.isTechnicalUpgrade) prefix = COMMIT_MESSAGE_PREFIXES.technicalUpgrade;

  return `${prefix} ${version.serviceId} ${version.termsType}`;
}

function buildVersionLink(baseUrl, version) {
  const encodedDate = encodeURIComponent(toISODateWithoutMilliseconds(version.fetchDate));
  const encodedService = encodeURIComponent(version.serviceId);
  const encodedTermsType = encodeURIComponent(version.termsType);

  return `${baseUrl}/version/${encodedService}/${encodedTermsType}/${encodedDate}`;
}

function buildEntryId(collection, version) {
  return `tag:${TAG_AUTHORITY}:version:${collection.metadata?.id}:${storageConfig.type}:${version.id}`;
}

function buildEntry(collection, baseUrl, version) {
  return {
    id: { _text: buildEntryId(collection, version) },
    link: { _attributes: {
      rel: 'alternate',
      type: 'text/html',
      href: buildVersionLink(baseUrl, version),
    } },
    title: { _text: buildEntryTitle(version) },
    updated: { _text: version.fetchDate.toISOString() },
    category: [
      { _attributes: { term: version.serviceId, scheme: SCHEMES.service } },
      { _attributes: { term: version.termsType, scheme: SCHEMES.termsType } },
      { _attributes: { term: classifyRecordType(version), scheme: SCHEMES.recordType } },
    ],
  };
}

function buildFeedDocument({ collection, selfHref, feedId, versions, baseUrl }) {
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

  feed.entry = versions.map(version => buildEntry(collection, baseUrl, version));

  return {
    _declaration: { _attributes: { version: '1.0', encoding: 'utf-8' } },
    feed,
  };
}

function sendAtom(res, xml) {
  res.set('Content-Type', 'application/atom+xml; charset=utf-8');
  res.status(200).send(xml);
}

function render(document) {
  return js2xml(document, { compact: true, spaces: 2 });
}

/**
 * @returns {express.Router} The router instance
 * @swagger
 * tags:
 *   name: Feeds
 *   description: Atom feeds of version changes
 */
export default function feedRouter() {
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
   *         description: An Atom 1.0 feed listing the latest version records, newest first.
   *         content:
   *           application/atom+xml:
   *             schema:
   *               type: string
   */
  router.get('/feed', async (req, res) => {
    const collection = await getCollection();
    const baseUrl = buildAbsoluteBaseUrl(req);
    const selfHref = `${baseUrl}/feed`;
    const feedId = `tag:${TAG_AUTHORITY}:feed:${collection.metadata?.id}`;

    const versions = await versionsRepository.findRecent(DEFAULT_LIMIT);
    const document = buildFeedDocument({ collection, selfHref, feedId, versions, baseUrl });

    sendAtom(res, render(document));
  });

  return router;
}
