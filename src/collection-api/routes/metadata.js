import fs from 'fs/promises';
import path from 'path';

import express from 'express';
import yaml from 'js-yaml';

import Service from '../../archivist/services/service.js';

const METADATA_FILENAME = 'metadata.yml';
const PACKAGE_JSON_PATH = '../../../package.json';

/**
 * @swagger
 * tags:
 *   name: Metadata
 *   description: Collection metadata API
 * components:
 *   schemas:
 *     Metadata:
 *       type: object
 *       description: Collection metadata
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier of the collection
 *         name:
 *           type: string
 *           description: Display name of the collection
 *         tagline:
 *           type: string
 *           description: Short description of the collection
 *         description:
 *           type: string
 *           nullable: true
 *           description: Detailed description of the collection
 *         totalTerms:
 *           type: integer
 *           description: Total number of terms tracked in the collection
 *         totalServices:
 *           type: integer
 *           description: Total number of services tracked in the collection
 *         engineVersion:
 *           type: string
 *           description: Version of the Open Terms Archive engine in SemVer format (MAJOR.MINOR.PATCH)
 *         dataset:
 *           type: string
 *           format: uri
 *           description: URL to the dataset releases
 *         declarations:
 *           type: string
 *           format: uri
 *           description: URL to the declarations repository
 *         versions:
 *           type: string
 *           format: uri
 *           description: URL to the versions repository
 *         snapshots:
 *           type: string
 *           format: uri
 *           description: URL to the snapshots repository
 *         logo:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL to the collection logo
 *         languages:
 *           type: array
 *           items:
 *             type: string
 *           description: List of ISO 639 language codes representing languages allowed by the collection
 *         jurisdictions:
 *           type: array
 *           items:
 *             type: string
 *           description: List of ISO 3166-2 country codes representing jurisdictions covered by the collection
 *         trackingPeriods:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               startDate:
 *                 type: string
 *                 format: date
 *                 description: The date when tracking started for this period
 *               schedule:
 *                 type: string
 *                 description: A cron expression defining when terms are tracked (e.g. "0 0 * * *" for daily at midnight)
 *               serverLocation:
 *                 type: string
 *                 description: The geographic location of the server used for tracking
 *               endDate:
 *                 type: string
 *                 format: date
 *                 description: The date when tracking ended for this period
 *         governance:
 *           type: object
 *           properties:
 *             hosts:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Organization'
 *             administrators:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Organization'
 *             curators:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Organization'
 *             maintainers:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Organization'
 *             sponsors:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Organization'
 *     Organization:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Name of the organization
 *         url:
 *           type: string
 *           format: uri
 *           description: URL to the organization's website
 *         logo:
 *           type: string
 *           format: uri
 *           description: URL to the organization's logo
 */
export default async function metadataRouter(collectionPath, services) {
  const router = express.Router();

  const STATIC_METADATA = yaml.load(await fs.readFile(path.join(collectionPath, METADATA_FILENAME), 'utf8'));
  const { version: engineVersion } = JSON.parse(await fs.readFile(new URL(PACKAGE_JSON_PATH, import.meta.url)));

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
      engineVersion,
    };

    res.json({
      ...STATIC_METADATA,
      ...dynamicMetadata,
    });
  });

  return router;
}
