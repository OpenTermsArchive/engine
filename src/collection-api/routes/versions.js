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
 *   parameters:
 *     LimitParam:
 *       in: query
 *       name: limit
 *       description: |
 *         The maximum number of versions to return.
 *
 *         **Note for Git storage**: Pagination uses Git's `--skip` and `--max-count` options,
 *         which work in topological order rather than strictly chronological order.
 *         This means paginated results may not be in perfect chronological sequence,
 *         but this is an acceptable performance trade-off.
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 500
 *         default: 100
 *       required: false
 *     OffsetParam:
 *       in: query
 *       name: offset
 *       description: |
 *         The number of versions to skip before returning results.
 *
 *         **Note for Git storage**: Pagination uses Git's `--skip` and `--max-count` options,
 *         which work in topological order rather than strictly chronological order.
 *       schema:
 *         type: integer
 *         minimum: 0
 *         default: 0
 *       required: false
 *   schemas:
 *     Version:
 *       type: object
 *       description: Version content and metadata
 *       properties:
 *         id:
 *           type: string
 *           description: The ID of the version.
 *         serviceId:
 *           type: string
 *           description: The ID of the service.
 *         termsType:
 *           type: string
 *           description: The type of terms.
 *         fetchDate:
 *           type: string
 *           format: date-time
 *           description: The ISO 8601 datetime string when the version was recorded.
 *         isFirstRecord:
 *           type: boolean
 *           description: Whether this version is the first one recorded for this service and terms type.
 *         content:
 *           type: string
 *           description: The JSON-escaped Markdown content of the version
 *     VersionListItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The ID of the version.
 *         serviceId:
 *           type: string
 *           description: The ID of the service.
 *         termsType:
 *           type: string
 *           description: The type of terms.
 *         fetchDate:
 *           type: string
 *           format: date-time
 *           description: The ISO 8601 datetime string when the version was recorded.
 *         isFirstRecord:
 *           type: boolean
 *           description: Whether this version is the first one recorded for this service and terms type.
 *     VersionListItemWithStats:
 *       allOf:
 *         - $ref: '#/components/schemas/VersionListItem'
 *         - type: object
 *           properties:
 *             additions:
 *               type: integer
 *               nullable: true
 *               description: The number of lines added in this version, or null if not available.
 *             deletions:
 *               type: integer
 *               nullable: true
 *               description: The number of lines deleted in this version, or null if not available.
 *     PaginatedVersionsResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           description: The list of versions.
 *           items:
 *             $ref: '#/components/schemas/VersionListItem'
 *         count:
 *           type: integer
 *           description: The total number of versions found.
 *         limit:
 *           type: integer
 *           description: The maximum number of versions returned in this response.
 *         offset:
 *           type: integer
 *           description: The number of versions skipped before returning results.
 *     PaginatedVersionsWithStatsResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           description: The list of versions with diff statistics.
 *           items:
 *             $ref: '#/components/schemas/VersionListItemWithStats'
 *         count:
 *           type: integer
 *           description: The total number of versions found.
 *         limit:
 *           type: integer
 *           description: The maximum number of versions returned in this response.
 *         offset:
 *           type: integer
 *           description: The number of versions skipped before returning results.
 *     VersionWithLinks:
 *       allOf:
 *         - $ref: '#/components/schemas/Version'
 *         - type: object
 *           properties:
 *             additions:
 *               type: integer
 *               nullable: true
 *               description: The number of lines added in this version, or null if not available.
 *             deletions:
 *               type: integer
 *               nullable: true
 *               description: The number of lines deleted in this version, or null if not available.
 *             links:
 *               type: object
 *               description: Navigation links to related versions.
 *               properties:
 *                 first:
 *                   type: string
 *                   description: The ID of the first version for this service and terms type.
 *                   nullable: true
 *                 prev:
 *                   type: string
 *                   description: The ID of the previous version, or null if this is the first.
 *                   nullable: true
 *                 next:
 *                   type: string
 *                   description: The ID of the next version, or null if this is the last.
 *                   nullable: true
 *                 last:
 *                   type: string
 *                   description: The ID of the last version for this service and terms type.
 *                   nullable: true
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           description: Error message.
 *   responses:
 *     BadRequestError:
 *       description: Invalid pagination parameters.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *     NotFoundError:
 *       description: Resource not found.
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 */
const router = express.Router();

const versionsRepository = await RepositoryFactory.create(config.get('@opentermsarchive/engine.recorder.versions.storage')).initialize();

function parsePaginationParams(query) {
  const limit = query.limit ? parseInt(query.limit, 10) : 100;
  const offset = query.offset ? parseInt(query.offset, 10) : 0;

  return { limit, offset };
}

function validatePaginationParams(limit, offset) {
  if (Number.isNaN(limit) || limit < 1) {
    return { error: 'Invalid limit parameter. Must be a positive integer.' };
  }

  if (limit > 500) {
    return { error: 'Invalid limit parameter. Must not exceed 500.' };
  }

  if (Number.isNaN(offset) || offset < 0) {
    return { error: 'Invalid offset parameter. Must be a non-negative integer.' };
  }

  return null;
}

function mapVersionToListItem(version) {
  return {
    id: version.id,
    serviceId: version.serviceId,
    termsType: version.termsType,
    fetchDate: toISODateWithoutMilliseconds(version.fetchDate),
    isFirstRecord: version.isFirstRecord,
    isTechnicalUpgrade: version.isTechnicalUpgrade,
  };
}

function mapVersionToDetailResponse(version, links) {
  return {
    id: version.id,
    serviceId: version.serviceId,
    termsType: version.termsType,
    fetchDate: toISODateWithoutMilliseconds(version.fetchDate),
    content: version.content,
    isFirstRecord: version.isFirstRecord,
    isTechnicalUpgrade: version.isTechnicalUpgrade,
    links: {
      first: links.first?.id || null,
      prev: links.prev?.id || null,
      next: links.next?.id || null,
      last: links.last?.id || null,
    },
  };
}

/**
 * @private
 * @swagger
 * /versions:
 *   get:
 *     summary: Get all versions.
 *     tags: [Versions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *     responses:
 *       200:
 *         description: A JSON object containing the list of all versions and metadata.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedVersionsResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 */
router.get('/versions', async (req, res) => {
  const { limit, offset } = parsePaginationParams(req.query);
  const validationError = validatePaginationParams(limit, offset);

  if (validationError) {
    return res.status(400).json(validationError);
  }

  const paginatedVersions = await versionsRepository.findAll({ limit, offset });

  const versionsList = paginatedVersions.map(mapVersionToListItem);

  const response = {
    data: versionsList,
    count: await versionsRepository.count(),
    limit,
    offset,
  };

  return res.status(200).json(response);
});

/**
 * @private
 * @swagger
 * /versions/{serviceId}:
 *   get:
 *     summary: Get all versions for a specific service.
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
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *     responses:
 *       200:
 *         description: A JSON object containing the list of versions and metadata.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedVersionsResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/versions/:serviceId', async (req, res) => {
  const { serviceId } = req.params;
  const { limit, offset } = parsePaginationParams(req.query);
  const validationError = validatePaginationParams(limit, offset);

  if (validationError) {
    return res.status(400).json(validationError);
  }

  const totalCount = await versionsRepository.count(serviceId);

  if (totalCount === 0) {
    return res.status(404).json({ error: `No versions found for service "${serviceId}"` });
  }

  const paginatedVersions = await versionsRepository.findByService(serviceId, { limit, offset });

  const versionsList = paginatedVersions.map(mapVersionToListItem);

  const response = {
    data: versionsList,
    count: totalCount,
    limit,
    offset,
  };

  return res.status(200).json(response);
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
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/OffsetParam'
 *     responses:
 *       200:
 *         description: A JSON object containing the list of versions with diff statistics and metadata.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedVersionsWithStatsResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequestError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/versions/:serviceId/:termsType', async (req, res) => {
  const { serviceId, termsType } = req.params;
  const { limit, offset } = parsePaginationParams(req.query);
  const validationError = validatePaginationParams(limit, offset);

  if (validationError) {
    return res.status(400).json(validationError);
  }

  const totalCount = await versionsRepository.count(serviceId, termsType);

  if (totalCount === 0) {
    return res.status(404).json({ error: `No versions found for service "${serviceId}" and terms type "${termsType}"` });
  }

  const paginatedVersions = await versionsRepository.findByServiceAndTermsType(serviceId, termsType, { limit, offset });

  const versionsList = await Promise.all(paginatedVersions.map(async version => {
    const stats = await versionsRepository.getDiffStats(version.id);

    return {
      ...mapVersionToListItem(version),
      ...stats,
    };
  }));

  const response = {
    data: versionsList,
    count: totalCount,
    limit,
    offset,
  };

  return res.status(200).json(response);
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
 *               $ref: '#/components/schemas/VersionWithLinks'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/version/:versionId', async (req, res) => {
  const { versionId } = req.params;

  const version = await versionsRepository.findById(versionId);

  if (!version) {
    return res.status(404).json({ error: `No version found with ID "${versionId}"` });
  }

  const [ first, prev, next, last, stats ] = await Promise.all([
    versionsRepository.findFirst(version.serviceId, version.termsType),
    versionsRepository.findPrevious(versionId),
    versionsRepository.findNext(versionId),
    versionsRepository.findLatest(version.serviceId, version.termsType),
    versionsRepository.getDiffStats(versionId),
  ]);

  return res.status(200).json({
    ...mapVersionToDetailResponse(version, { first, prev, next, last }),
    ...stats,
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
 *         description: A JSON object containing the version content, metadata, and navigation links.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VersionWithLinks'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/version/:serviceId/:termsType/latest', async (req, res) => {
  const { serviceId, termsType } = req.params;

  const version = await versionsRepository.findLatest(serviceId, termsType);

  if (!version) {
    return res.status(404).json({ error: `No version found for service "${serviceId}" and terms type "${termsType}"` });
  }

  const [ first, prev, next, last ] = await Promise.all([
    versionsRepository.findFirst(version.serviceId, version.termsType),
    versionsRepository.findPrevious(version.id),
    versionsRepository.findNext(version.id),
    versionsRepository.findLatest(version.serviceId, version.termsType),
  ]);

  return res.status(200).json(mapVersionToDetailResponse(version, { first, prev, next, last }));
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
 *         description: A JSON object containing the version content, metadata, and navigation links.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VersionWithLinks'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       416:
 *         description: The requested date is in the future.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/version/:serviceId/:termsType/:date', async (req, res) => {
  const { serviceId, termsType, date } = req.params;
  const requestedDate = new Date(date);

  if (requestedDate > new Date()) {
    return res.status(416).json({ error: 'Requested version is in the future' });
  }

  const version = await versionsRepository.findByDate(serviceId, termsType, requestedDate);

  if (!version) {
    return res.status(404).json({ error: `No version found for service "${serviceId}" and terms type "${termsType}" at date ${date}` });
  }

  const [ first, prev, next, last ] = await Promise.all([
    versionsRepository.findFirst(version.serviceId, version.termsType),
    versionsRepository.findPrevious(version.id),
    versionsRepository.findNext(version.id),
    versionsRepository.findLatest(version.serviceId, version.termsType),
  ]);

  return res.status(200).json(mapVersionToDetailResponse(version, { first, prev, next, last }));
});

export default router;
