import express from 'express';

import * as Services from '../../archivist/services/index.js';

const services = await Services.load();

/**
 * @swagger
 * tags:
 *   name: Services
 *   description: Services API
 * components:
 *   schemas:
 *     Service:
 *       type: object
 *       description: Definition of a service and the agreements its provider sets forth. While the information is the same, the format differs from the JSON declaration files that are designed for readability by contributors.
 *       properties:
 *         id:
 *           type: string
 *           description: The ID of the service.
 *         name:
 *           type: string
 *           description: The name of the service.
 *         terms:
 *           type: array
 *           description: Information that enables tracking the content of agreements defined by the service provider.
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 description: The type of terms.
 *               sourceDocuments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     location:
 *                       type: string
 *                       description: The URL location of the source document.
 *                     executeClientScripts:
 *                       type: boolean
 *                       description: Whether client-side scripts should be executed.
 *                     contentSelectors:
 *                       type: string
 *                       description: The CSS selectors for selecting significant content.
 *                     insignificantContentSelectors:
 *                       type: string
 *                       description: The CSS selectors for selecting insignificant content.
 *                     filters:
 *                       type: array
 *                       items:
 *                         type: string
 *                         description: The names of filters to apply to the content.
 */
const router = express.Router();

/**
 * @swagger
 * /services:
 *   get:
 *     summary: Enumerate all services.
 *     tags: [Services]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: A JSON array of all services.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 */
router.get('/', (req, res) => {
  res.status(200).json(Object.values(services).map(service => ({
    id: service.id,
    name: service.name,
  })));
});

/**
 * @swagger
 * /service/{serviceId}:
 *   get:
 *     summary: Retrieve the declaration of a specific service through its ID.
 *     tags: [Services]
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         description: The ID of the service.
 *         schema:
 *           type: string
 *         required: true
 *         example: service-1
 *     responses:
 *       200:
 *         description: The full JSON declaration of the service with the given ID.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       404:
 *         description: No service matching the provided ID is found.
 */
router.get('/:serviceId', (req, res) => {
  const service = services[req.params.serviceId];

  if (!service) {
    res.status(404).send('Service not found');

    return;
  }

  res.status(200).json({
    id: service.id,
    name: service.name,
    terms: service.getTerms().map(terms => ({
      type: terms.type,
      sourceDocuments: terms.sourceDocuments.map(({ location, contentSelectors, insignificantContentSelectors, filters: sourceDocumentFilters, executeClientScripts }) => ({
        location,
        contentSelectors,
        insignificantContentSelectors,
        executeClientScripts,
        filters: sourceDocumentFilters?.map(filter => filter.name),
      })),
    })),
  });
});

export default router;
