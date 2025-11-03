import config from 'config';
import express from 'express';

import RepositoryFactory from '../../archivist/recorder/repositories/factory.js';
import { toISODateWithoutMilliseconds } from '../../archivist/utils/date.js';

/**
 * @private
 * @swagger
 * tags:
 *   name: Versions
 *   description: Versions API
 * components:
 *   schemas:
 *     Version:
 *       type: object
 *       description: Version content and metadata
 *       properties:
 *         fetchDate:
 *           type: string
 *           format: date-time
 *           description: The ISO 8601 datetime string when the version was recorded.
 *         id:
 *           type: string
 *           description: The ID of the version.
 *         content:
 *           type: string
 *           description: The JSON-escaped Markdown content of the version
 */
const router = express.Router();

const versionsRepository = await RepositoryFactory.create(config.get('@opentermsarchive/engine.recorder.versions.storage')).initialize();

/**
 * @private
 * @swagger
 * /versions:
 *   get:
 *     summary: Get all versions.
 *     tags: [Versions]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A JSON object containing the list of all versions and metadata.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   description: The list of all versions.
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: The ID of the version.
 *                       fetchDate:
 *                         type: string
 *                         format: date-time
 *                         description: The ISO 8601 datetime string when the version was recorded.
 *                 count:
 *                   type: integer
 *                   description: The total number of versions found.
 */
router.get('/versions', async (req, res) => {
  const versions = await versionsRepository.findAll();
  const versionsList = versions.map(version => ({
    id: version.id,
    fetchDate: toISODateWithoutMilliseconds(version.fetchDate),
  }));

  return res.status(200).json({
    data: versionsList,
    count: versionsList.length,
  });
});

/**
 * @private
 * @swagger
 * /versions/{serviceId}/{termsType}:
 *   get:
 *     summary: Get all versions of some terms for a specific service.
 *     tags: [Versions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         description: The ID of the service whose versions will be returned.
 *         schema:
 *           type: string
 *         required: true
 *       - in: path
 *         name: termsType
 *         description: The type of terms whose versions will be returned.
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: A JSON object containing the list of versions and metadata.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   description: The list of versions.
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         description: The ID of the version.
 *                       fetchDate:
 *                         type: string
 *                         format: date-time
 *                         description: The ISO 8601 datetime string when the version was recorded.
 *                 count:
 *                   type: integer
 *                   description: The total number of versions found.
 *       404:
 *         description: No versions found for the specified combination of service ID and terms type.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message indicating that no versions are found.
 */
router.get('/versions/:serviceId/:termsType', async (req, res) => {
  const { serviceId, termsType } = req.params;

  const versions = await versionsRepository.findByServiceAndTermsType(serviceId, termsType);
  const versionsList = versions.map(version => ({
    id: version.id,
    fetchDate: toISODateWithoutMilliseconds(version.fetchDate),
  }));

  if (versionsList.length === 0) {
    return res.status(404).json({ error: `No versions found for service "${serviceId}" and terms type "${termsType}"` });
  }

  return res.status(200).json({
    data: versionsList,
    count: versionsList.length,
  });
});

/**
 * @private
 * @swagger
 * /version/{versionId}:
 *   get:
 *     summary: Get a specific version by its ID.
 *     tags: [Versions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: path
 *         name: versionId
 *         description: The ID of the version to retrieve.
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: A JSON object containing the version content, metadata, and navigation links.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Version'
 *                 - type: object
 *                   properties:
 *                     links:
 *                       type: object
 *                       description: Navigation links to related versions.
 *                       properties:
 *                         first:
 *                           type: string
 *                           description: The ID of the first version for this service and terms type.
 *                           nullable: true
 *                         prev:
 *                           type: string
 *                           description: The ID of the previous version, or null if this is the first.
 *                           nullable: true
 *                         next:
 *                           type: string
 *                           description: The ID of the next version, or null if this is the last.
 *                           nullable: true
 *                         last:
 *                           type: string
 *                           description: The ID of the last version for this service and terms type.
 *                           nullable: true
 *       404:
 *         description: No version found with the specified ID.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message indicating that no version is found.
 */
router.get('/version/:versionId', async (req, res) => {
  const { versionId } = req.params;

  const version = await versionsRepository.findById(versionId);

  if (!version) {
    return res.status(404).json({ error: `No version found with ID "${versionId}"` });
  }

  const [ firstVersion, prevVersion, nextVersion, lastVersion ] = await Promise.all([
    versionsRepository.findFirst(version.serviceId, version.termsType),
    versionsRepository.findPrevious(versionId),
    versionsRepository.findNext(versionId),
    versionsRepository.findLatest(version.serviceId, version.termsType),
  ]);

  return res.status(200).json({
    id: version.id,
    fetchDate: toISODateWithoutMilliseconds(version.fetchDate),
    content: version.content,
    links: {
      first: firstVersion?.id || null,
      prev: prevVersion?.id || null,
      next: nextVersion?.id || null,
      last: lastVersion?.id || null,
    },
  });
});

/**
 * @private
 * @swagger
 * /version/{serviceId}/{termsType}/latest:
 *   get:
 *     summary: Get the latest version of some terms for a service.
 *     tags: [Versions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         description: The ID of the service whose version will be returned.
 *         schema:
 *           type: string
 *         required: true
 *       - in: path
 *         name: termsType
 *         description: The type of terms whose version will be returned.
 *         schema:
 *           type: string
 *         required: true
 *     responses:
 *       200:
 *         description: A JSON object containing the version content and metadata.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Version'
 *       404:
 *         description: No version found for the specified combination of service ID and terms type.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message indicating that no version is found.
 */
router.get('/version/:serviceId/:termsType/latest', async (req, res) => {
  const { serviceId, termsType } = req.params;

  const version = await versionsRepository.findLatest(serviceId, termsType);

  if (!version) {
    return res.status(404).json({ error: `No version found for service "${serviceId}" and terms type "${termsType}"` });
  }

  const [ firstVersion, prevVersion, nextVersion, lastVersion ] = await Promise.all([
    versionsRepository.findFirst(version.serviceId, version.termsType),
    versionsRepository.findPrevious(version.id),
    versionsRepository.findNext(version.id),
    versionsRepository.findLatest(version.serviceId, version.termsType),
  ]);

  return res.status(200).json({
    id: version.id,
    fetchDate: toISODateWithoutMilliseconds(version.fetchDate),
    content: version.content,
    links: {
      first: firstVersion?.id || null,
      prev: prevVersion?.id || null,
      next: nextVersion?.id || null,
      last: lastVersion?.id || null,
    },
  });
});

/**
 * @private
 * @swagger
 * /version/{serviceId}/{termsType}/{date}:
 *   get:
 *     summary: Get a specific version of some terms at a given date.
 *     tags: [Versions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         description: The ID of the service whose version will be returned.
 *         schema:
 *           type: string
 *         required: true
 *       - in: path
 *         name: termsType
 *         description: The type of terms whose version will be returned.
 *         schema:
 *           type: string
 *         required: true
 *       - in: path
 *         name: date
 *         description: The date and time for which the version is requested, in ISO 8601 format.
 *         schema:
 *           type: string
 *           format: date-time
 *         required: true
 *     responses:
 *       200:
 *         description: A JSON object containing the version content and metadata.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Version'
 *       404:
 *         description: No version found for the specified combination of service ID, terms type and date.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message indicating that no version is found.
 *       416:
 *         description: The requested date is in the future.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message indicating that the requested date is in the future.
 */
router.get('/version/:serviceId/:termsType/:date', async (req, res) => {
  const { serviceId, termsType, date } = req.params;
  const requestedDate = new Date(date);

  if (requestedDate > new Date()) {
    return res.status(416).json({ error: 'Requested version is in the future' });
  }

  const version = await versionsRepository.findByDate(serviceId, termsType, requestedDate);

  if (!version) {
    return res.status(404).json({ error: `No version found for date ${date}` });
  }

  const [ firstVersion, prevVersion, nextVersion, lastVersion ] = await Promise.all([
    versionsRepository.findFirst(version.serviceId, version.termsType),
    versionsRepository.findPrevious(version.id),
    versionsRepository.findNext(version.id),
    versionsRepository.findLatest(version.serviceId, version.termsType),
  ]);

  return res.status(200).json({
    id: version.id,
    fetchDate: toISODateWithoutMilliseconds(version.fetchDate),
    content: version.content,
    links: {
      first: firstVersion?.id || null,
      prev: prevVersion?.id || null,
      next: nextVersion?.id || null,
      last: lastVersion?.id || null,
    },
  });
});

export default router;
