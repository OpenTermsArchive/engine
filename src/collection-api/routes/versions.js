import express from 'express';

import { toISODateWithoutMilliseconds } from '../../archivist/utils/date.js';

import { findServiceCaseInsensitive } from './utils.js';

/**
 * @param   {object}         services           The services to be exposed by the API
 * @param   {object}         versionsRepository The versions repository instance
 * @returns {express.Router}                    The router instance
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
export default function versionsRouter(services, versionsRepository) {
  const router = express.Router();

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
    const { termsType, date } = req.params;
    const requestedDate = new Date(date);

    if (requestedDate > new Date()) {
      return res.status(416).json({ error: 'Requested version is in the future' });
    }

    const service = findServiceCaseInsensitive(services, req.params.serviceId);

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    const version = await versionsRepository.findByDate(service.id, termsType, requestedDate);

    if (!version) {
      return res.status(404).json({ error: `No version found for date ${date}` });
    }

    return res.status(200).json({
      id: version.id,
      fetchDate: toISODateWithoutMilliseconds(version.fetchDate),
      content: version.content,
    });
  });

  return router;
}
