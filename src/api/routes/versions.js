import config from 'config';
import express from 'express';

import RepositoryFactory from '../../archivist/recorder/repositories/factory.js';
import { toISODateWithoutMilliseconds } from '../../archivist/utils/date.js';

/**
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
 *           description: The ISO 8601 datetime string when the version was fetched.
 *         id:
 *           type: string
 *           description: The ID of the version.
 *         content:
 *           type: string
 *           description: The JSON-escaped Markdown content of the version.
 */
const router = express.Router();

const versionsRepository = await RepositoryFactory.create(config.get('recorder.versions.storage')).initialize();

/**
 * @swagger
 * /version/{serviceId}/{termsType}/{date}:
 *   get:
 *     summary: Get version for a given date.
 *     tags: [Versions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         description: The ID of the service.
 *         schema:
 *           type: string
 *         required: true
 *       - in: path
 *         name: termsType
 *         description: The name of terms type.
 *         schema:
 *           type: string
 *         required: true
 *       - in: path
 *         name: date
 *         description: The date and time for which the version is requested.
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
 *         description: No version found for the specified date.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message indicating no version found.
 *       416:
 *         description: Requested version is in the future.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message indicating the requested date is in the future.
 */
router.get('/version/:serviceId/:termsType/:date', async (req, res) => {
  const { serviceId, termsType, date } = req.params;
  const requestedDate = new Date(date);

  if (requestedDate > new Date()) {
    return res.status(416).json({ error: 'Requested version is in the future' });
  }

  const version = await versionsRepository.findByDate(serviceId, termsType, requestedDate);

  if (version) {
    return res.status(200).json({
      id: version.id,
      fetchDate: toISODateWithoutMilliseconds(version.fetchDate),
      content: version.content,
    });
  }

  return res.status(404).json({ error: `No version found for date ${date}` });
});

export default router;
