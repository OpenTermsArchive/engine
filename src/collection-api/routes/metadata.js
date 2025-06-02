import { createRequire } from 'module';

import express from 'express';

import Service from '../../archivist/services/service.js';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION } = require('../../../package.json');

/**
 * @param   {object}         collection The collection
 * @param   {object}         services   The services of the collection
 * @returns {express.Router}            The router instance
 * @swagger
 * tags:
 *   name: Metadata
 *   description: Collection metadata API
 * components:
 *   schemas:
 *     Metadata:
 *       type: object
 *       description: Collection metadata
 *       additionalProperties: false
 *       required:
 *         - id
 *         - name
 *         - tagline
 *         - languages
 *         - jurisdictions
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier derived from name (acronyms, dash-separated).
 *           example: demo
 *         name:
 *           type: string
 *           description: Display name of the collection.
 *           example: Demo Collection
 *         tagline:
 *           type: string
 *           description: Concise description of collection topic.
 *           example: Services used by Open Terms Archive
 *         languages:
 *           type: array
 *           description: List of [ISO 639-1 (two-letter)](https://en.wikipedia.org/wiki/ISO_639) language codes representing languages allowed in the collection.
 *           example: [en, fr, de]
 *           items:
 *             type: string
 *             format: iso639-1
 *         jurisdictions:
 *           type: array
 *           description: List of [ISO 3166-2 country codes](https://en.wikipedia.org/wiki/ISO_3166-2) representing jurisdictions covered by the collection.
 *           example: [EU]
 *           items:
 *             type: string
 *             format: iso3166-2
 *         description:
 *           type: string
 *           description: Detailed description of the collection
 *           example: |
 *             The **Demo** collection tracks changes to the terms of use of services used by Open Terms Archive.
 *
 *             This provides a reference collection for best practices and enables the Open Terms Archive Core Team to be a user of the software it produces.
 *         totalTerms:
 *           type: integer
 *           description: Total number of terms tracked in the collection.
 *           x-ota-generated: true
 *         totalServices:
 *           type: integer
 *           description: Total number of services tracked in the collection.
 *           x-ota-generated: true
 *         engineVersion:
 *           type: string
 *           description: Version of the Open Terms Archive engine in SemVer format (MAJOR.MINOR.PATCH).
 *           x-ota-generated: true
 *         dataset:
 *           type: string
 *           format: uri
 *           description: URL to the dataset releases.
 *           example: https://github.com/OpenTermsArchive/demo-versions/releases
 *         declarations:
 *           type: string
 *           format: uri
 *           description: URL to the declarations repository.
 *           example: https://github.com/OpenTermsArchive/demo-declarations
 *         versions:
 *           type: string
 *           format: uri
 *           description: URL to the versions repository.
 *           example: https://github.com/OpenTermsArchive/demo-versions
 *         snapshots:
 *           type: string
 *           format: uri
 *           description: URL to the snapshots repository.
 *           example: https://github.com/OpenTermsArchive/demo-snapshots
 *         donations:
 *           type: string
 *           format: uri
 *           description: URL to the donations page.
 *           example: https://opencollective.com/opentermsarchive
 *         logo:
 *           type: string
 *           format: uri
 *           description: URL to the collection's logo. Optimized PNG transparent image (minimum width 240px).
 *           example: https://opentermsarchive.org/images/logo/logo-open-terms-archive-black.png
 *         trackingPeriods:
 *           type: array
 *           description: List of time periods during which terms were tracked, with their tracking configuration. Gaps between periods indicate times when tracking was interrupted.
 *           items:
 *             type: object
 *             additionalProperties: false
 *             required:
 *               - startDate
 *               - schedule
 *               - serverLocation
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: The date when tracking started for this period (ISO 8601 format YYYY-MM-DD).
 *                 example: 2023-01-01
 *               schedule:
 *                 type: string
 *                 format: cron-expression
 *                 description: A [cron expression](https://en.wikipedia.org/wiki/Cron#Cron_expression) that defines the tracking frequency.
 *                 example: 0 0 * * *
 *               serverLocation:
 *                 type: string
 *                 description: The geographic location of the tracking server (city name and ISO 3166-2 country code).
 *                 example: Paris, FR
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: The date when tracking ended for this period (ISO 8601 format YYYY-MM-DD). If not specified, tracking is ongoing.
 *                 example: 2023-12-01
 *         governance:
 *           type: object
 *           description: Map of organizations involved in the collection's governance, with organization names as keys and governance objects as values.
 *           additionalProperties:
 *             type: object
 *             additionalProperties: false
 *             required:
 *               - roles
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: URL to the entity's website
 *                 example: https://opentermsarchive.org/
 *               logo:
 *                 type: string
 *                 format: uri
 *                 description: URL to the entity's logo. Optimized PNG transparent image (minimum width 240px).
 *                 example: https://opentermsarchive.org/images/logo/logo-open-terms-archive-black.png
 *               roles:
 *                 type: array
 *                 description: Roles of the entity within the governance, see [collection governance](https://docs.opentermsarchive.org/collections/reference/governance/)
 *                 example: [host, administrator]
 *                 items:
 *                   type: string
 *                   enum: [host, administrator, curator, maintainer, sponsor]
 *         i18n:
 *           type: object
 *           description: Internationalization of any of the Metadata properties (except i18n itself) for different language codes
 *           example: |
 *             fr:
 *               name: Démo
 *               tagline: Services utilisés par Open Terms Archive
 *               governance:
 *                 Ministry for Europe and Foreign Affairs:
 *                   name: Ministère de l'Europe et des Affaires étrangères
 *                   url: https://www.diplomatie.gouv.fr
 *           additionalProperties:
 *             type: object
 */
export default function metadataRouter(collection, services) {
  const router = express.Router();

  /**
   * @swagger
   * /metadata:
   *   get:
   *     summary: Get collection metadata
   *     tags: [Metadata]
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: Collection metadata
   */
  router.get('/metadata', (req, res) => {
    const dynamicMetadata = {
      totalServices: Object.keys(services).length,
      totalTerms: Service.getNumberOfTerms(services),
      engineVersion: PACKAGE_VERSION,
    };

    res.json({
      ...collection.metadata,
      ...dynamicMetadata,
    });
  });

  return router;
}
