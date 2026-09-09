import http from 'http';

import express from 'express';

import { buildAbsoluteBaseUrl } from '../utils/url.js';

const NO_DATASET_ERROR = 'No dataset has been generated yet';
const TRANSFER_HEADERS = [ 'Accept-Ranges', 'Cache-Control', 'Content-Disposition', 'Content-Length', 'Content-Range', 'Content-Type', 'ETag', 'Last-Modified' ];
const METADATA_PATH = '/dataset/latest';
const DOWNLOAD_PATH = `${METADATA_PATH}/download`;

function handleTransferError(error, res, next) {
  if (!error || error.code === 'ECONNABORTED') {
    return;
  }

  if (res.headersSent) { // The transfer started before failing: `send` destroyed the read stream but never ended the response, so it must be forwarded to end it instead of leaving the client waiting
    return next(error);
  }

  if (error.status === 404) { // The archive was replaced under another name between the metadata lookup and the transfer
    return res.status(404).json({ error: NO_DATASET_ERROR });
  }

  if (error.status < 500) { // Client errors raised by `send`, such as an unsatisfiable range or a failed precondition
    TRANSFER_HEADERS.forEach(header => res.removeHeader(header)); // `send` has already described the archive on the response when it rejects the request; those headers must not describe the JSON error instead

    return res.status(error.status).set(error.headers ?? {}).json({ error: http.STATUS_CODES[error.status] });
  }

  return next(error);
}

/**
 * @param   {object}         datasetStorage The storage holding the latest dataset of the collection
 * @returns {express.Router}                The router instance
 * @swagger
 * tags:
 *   name: Dataset
 *   description: Dataset API
 * components:
 *   schemas:
 *     Dataset:
 *       type: object
 *       description: Metadata of the latest dataset generated on this instance. Counts and dates are frozen at generation time, unlike the live counters of the collection metadata.
 *       additionalProperties: false
 *       required:
 *         - filename
 *         - title
 *         - license
 *         - releaseDate
 *         - firstVersionDate
 *         - lastVersionDate
 *         - servicesCount
 *         - termsCount
 *         - versionsCount
 *         - size
 *         - sha256
 *         - downloadURL
 *       properties:
 *         filename:
 *           type: string
 *           description: Name of the archive file.
 *           example: demo-2026-07-06.zip
 *         title:
 *           type: string
 *           description: Dataset title.
 *           example: demo
 *         license:
 *           type: string
 *           description: SPDX identifier of the dataset license.
 *           example: ODbL-1.0
 *         releaseDate:
 *           type: string
 *           format: date-time
 *           description: Datetime when the dataset was generated.
 *           example: 2026-07-06T08:30:12Z
 *         firstVersionDate:
 *           type: string
 *           format: date-time
 *           description: Fetch date of the earliest version in the dataset.
 *           example: 2022-01-01T12:00:00Z
 *         lastVersionDate:
 *           type: string
 *           format: date-time
 *           description: Fetch date of the latest version in the dataset.
 *           example: 2026-07-05T23:12:00Z
 *         servicesCount:
 *           type: integer
 *           description: Number of services in the dataset.
 *           example: 262
 *         termsCount:
 *           type: integer
 *           description: Number of distinct terms (service and terms type pairs) in the dataset.
 *           example: 641
 *         versionsCount:
 *           type: integer
 *           description: Total number of version files in the dataset.
 *           example: 38294
 *         size:
 *           type: integer
 *           description: Size of the archive in bytes.
 *           example: 104857600
 *         sha256:
 *           type: string
 *           description: SHA-256 checksum of the archive, allowing to verify its integrity and to detect changes without downloading it.
 *           example: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
 *         downloadURL:
 *           type: string
 *           format: uri
 *           description: Absolute URL of the archive download endpoint.
 *           example: https://example.org/collection-api/v1/dataset/latest/download
 */
export default function datasetRouter(datasetStorage) {
  const router = express.Router();

  /**
   * @swagger
   * /dataset/latest:
   *   get:
   *     summary: Get the metadata of the latest dataset.
   *     tags: [Dataset]
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: A JSON object describing the latest dataset generated on this instance.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Dataset'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  router.get(METADATA_PATH, async (req, res) => {
    const metadata = await datasetStorage.findLatest();

    if (!metadata) {
      return res.status(404).json({ error: NO_DATASET_ERROR });
    }

    return res.json({
      ...metadata,
      downloadURL: `${buildAbsoluteBaseUrl(req)}${DOWNLOAD_PATH}`,
    });
  });

  /**
   * @swagger
   * /dataset/latest/download:
   *   get:
   *     summary: Download the latest dataset archive.
   *     description: Streams the ZIP archive of the latest dataset. Supports conditional requests through the `If-None-Match` and `If-Modified-Since` headers, and resumable downloads through `Range` requests.
   *     tags: [Dataset]
   *     parameters:
   *       - in: header
   *         name: If-None-Match
   *         description: ETag of an archive already held by the client, to receive `304 Not Modified` when it is still the latest one.
   *         schema:
   *           type: string
   *       - in: header
   *         name: If-Modified-Since
   *         description: Date of an archive already held by the client, to receive `304 Not Modified` when no dataset was released since.
   *         schema:
   *           type: string
   *       - in: header
   *         name: If-Match
   *         description: ETag the client expects the archive to still match, to receive `412 Precondition Failed` when it changed.
   *         schema:
   *           type: string
   *       - in: header
   *         name: If-Unmodified-Since
   *         description: Date the client expects the archive to still match, to receive `412 Precondition Failed` when a newer dataset was released since.
   *         schema:
   *           type: string
   *       - in: header
   *         name: Range
   *         description: Byte range to resume an interrupted download.
   *         schema:
   *           type: string
   *           example: bytes=1048576-
   *       - in: header
   *         name: If-Range
   *         description: ETag or date the requested `Range` applies to, to fall back to a full `200` response with the whole archive when it no longer matches.
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: The dataset archive.
   *         headers:
   *           Content-Disposition:
   *             description: Attachment disposition carrying the archive file name.
   *             schema:
   *               type: string
   *           Content-Length:
   *             description: Size of the archive in bytes.
   *             schema:
   *               type: integer
   *           ETag:
   *             description: Quoted SHA-256 checksum of the archive.
   *             schema:
   *               type: string
   *           Last-Modified:
   *             description: Release date of the dataset.
   *             schema:
   *               type: string
   *           Accept-Ranges:
   *             description: Always `bytes`.
   *             schema:
   *               type: string
   *         content:
   *           application/zip:
   *             schema:
   *               type: string
   *               format: binary
   *       206:
   *         description: The requested byte range of the dataset archive.
   *         headers:
   *           Content-Range:
   *             schema:
   *               type: string
   *         content:
   *           application/zip:
   *             schema:
   *               type: string
   *               format: binary
   *       304:
   *         description: The client already holds the latest dataset archive.
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   *       412:
   *         description: The archive changed since the version referenced by `If-Match` or `If-Unmodified-Since`.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       416:
   *         description: The requested byte range cannot be satisfied.
   *         headers:
   *           Content-Range:
   *             schema:
   *               type: string
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get(DOWNLOAD_PATH, async (req, res, next) => {
    const metadata = await datasetStorage.findLatest();

    if (!metadata) {
      return res.status(404).json({ error: NO_DATASET_ERROR });
    }

    const options = {
      root: datasetStorage.path, // Confines the served file to the storage directory and keeps `send` from refusing paths that contain dot-directories
      dotfiles: 'allow', // Archive names are chosen by operators through `--file`; a name starting with a dot, such as `.weekly`, must still be served
      headers: { // Applied by `send` once the archive is found and kept over its own defaults, so that the validators describe the dataset rather than the file on disk
        ETag: `"${metadata.sha256}"`,
        'Last-Modified': new Date(metadata.releaseDate).toUTCString(),
      },
    };

    return res.download(metadata.filename, metadata.filename, options, error => handleTransferError(error, res, next));
  });

  return router;
}
