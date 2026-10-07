import express from 'express';

import { STATUSES } from '../../archivist/tracking-results/terms-result/index.js';
import { parsePaginationParams, validatePaginationParams } from '../utils/pagination.js';

const VALID_STATUSES = Object.values(STATUSES);

/**
 * @param   {object}         trackingResultsRepository The tracking-results repository instance
 * @param   {object}         services                  The declared services, keyed by ID
 * @returns {express.Router}                           The router instance
 * @private
 * @swagger
 * tags:
 *   name: Tracking results
 *   description: Tracking results API, serving the latest known tracking status of each terms as of the latest completed tracking run
 * components:
 *   parameters:
 *     TrackingResultsLimitParam:
 *       in: query
 *       name: limit
 *       description: The maximum number of tracking results to return.
 *       schema:
 *         type: integer
 *         minimum: 1
 *         maximum: 500
 *         default: 100
 *       required: false
 *     TrackingResultsOffsetParam:
 *       in: query
 *       name: offset
 *       description: The number of tracking results to skip before returning results.
 *       schema:
 *         type: integer
 *         minimum: 0
 *         default: 0
 *       required: false
 *   schemas:
 *     TrackingResult:
 *       type: object
 *       description: Latest known tracking status of some terms as of the latest completed tracking run; the terms that this run did not process, listed in its `coverage.skipped`, keep the status recorded by their previous tracking
 *       properties:
 *         serviceId:
 *           type: string
 *           description: The ID of the service.
 *         termsType:
 *           type: string
 *           description: The type of terms.
 *         declared:
 *           type: boolean
 *           description: Whether the terms are still declared in the collection. The tracking results of terms removed from the declarations are kept as a historical record.
 *         status:
 *           type: string
 *           enum: [ok, failed]
 *           description: Whether the latest tracking of the terms succeeded.
 *         event:
 *           type: object
 *           description: The latest substantive event of the tracking of the terms.
 *           properties:
 *             date:
 *               type: string
 *               format: date-time
 *               description: The ISO 8601 datetime string of the event, that is of the latest substantive change of the tracking status, not of the latest tracking.
 *             serviceName:
 *               type: string
 *               description: The human-readable name of the service.
 *             sourceDocuments:
 *               type: array
 *               description: The declaration applied to each source document, with the snapshot produced from it.
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   fetch:
 *                     type: string
 *                     format: uri
 *                   select: {}
 *                   remove: {}
 *                   filter: {}
 *                   executeClientScripts:
 *                     type: boolean
 *                   mimeType:
 *                     type: string
 *                     nullable: true
 *                   snapshotId:
 *                     type: string
 *                     nullable: true
 *                     description: The ID of the snapshot produced, or null if the source document could not be fetched.
 *             reasons:
 *               type: array
 *               description: The failure reasons, prefixed by their category (`[fetch]`, `[extraction]` or `[internal]`). Only present when the status is `failed`.
 *               items:
 *                 type: string
 *             transientError:
 *               type: object
 *               description: Only present when a likely transient error occurred before the terms could be tracked.
 *               properties:
 *                 reasons:
 *                   type: array
 *                   items:
 *                     type: string
 *     PaginatedTrackingResultsResponse:
 *       type: object
 *       properties:
 *         runId:
 *           type: string
 *           nullable: true
 *           description: The ID of the completed tracking run whose state the list reflects, null until a first run completes. Consumers paginating through the list should start over when it changes between two pages, as the pages then come from different runs.
 *         data:
 *           type: array
 *           description: The list of tracking results.
 *           items:
 *             $ref: '#/components/schemas/TrackingResult'
 *         count:
 *           type: integer
 *           description: The total number of tracking results found.
 *         limit:
 *           type: integer
 *           description: The maximum number of tracking results returned in this response.
 *         offset:
 *           type: integer
 *           description: The number of tracking results skipped before returning results.
 *     TrackingRun:
 *       type: object
 *       description: Summary of a tracking run
 *       properties:
 *         runId:
 *           type: string
 *           description: The ID of the run.
 *         collectionId:
 *           type: string
 *           description: The ID of the collection.
 *         schedule:
 *           type: string
 *           nullable: true
 *           description: The cron expression scheduling the tracking runs.
 *         lastRun:
 *           type: object
 *           properties:
 *             startDate:
 *               type: string
 *               format: date-time
 *             endDate:
 *               type: string
 *               format: date-time
 *             engineVersion:
 *               type: string
 *             status:
 *               type: string
 *               enum: [completed]
 *         declarations:
 *           type: object
 *           description: The declarations applied by the run.
 *           properties:
 *             commit:
 *               type: string
 *               description: The SHA of the declarations commit applied by the run, as loaded when the tracking process started.
 *             services:
 *               type: integer
 *             terms:
 *               type: integer
 *         tracked:
 *           type: object
 *           description: The number of terms tracked by the run, by status.
 *           properties:
 *             ok:
 *               type: integer
 *             failed:
 *               type: integer
 *         coverage:
 *           type: object
 *           properties:
 *             processed:
 *               type: integer
 *               description: The number of terms processed by the run.
 *             skipped:
 *               type: array
 *               description: The declared terms that the run did not process.
 *               items:
 *                 type: object
 *                 properties:
 *                   serviceId:
 *                     type: string
 *                   termsType:
 *                     type: string
 *                   reason:
 *                     type: string
 *         transitions:
 *           type: object
 *           description: The terms whose tracking status changed during the run.
 *           properties:
 *             newFailures:
 *               $ref: '#/components/schemas/TermsIdentifiers'
 *             recoveries:
 *               $ref: '#/components/schemas/TermsIdentifiers'
 *             reasonChanges:
 *               $ref: '#/components/schemas/TermsIdentifiers'
 *         transientErrors:
 *           type: integer
 *           description: The number of terms tracked after a likely transient error.
 *     TermsIdentifiers:
 *       type: array
 *       items:
 *         type: object
 *         properties:
 *           serviceId:
 *             type: string
 *           termsType:
 *             type: string
 */
export default function trackingResultsRouter(trackingResultsRepository, services) {
  const router = express.Router();

  function toResponse({ serviceId, termsType, status, event }) {
    return { serviceId, termsType, declared: isDeclared(serviceId, termsType), status, event };
  }

  function isDeclared(serviceId, termsType) { // The tracking results of terms removed from the declarations are kept as a historical record, so consumers need to tell them apart from the terms still tracked
    return Object.hasOwn(services, serviceId) && services[serviceId].getTermsTypes().includes(termsType);
  }

  async function findTermsResults(filter) { // Every read of a request is pinned to the same commit, so that a run completing meanwhile cannot mix the states of two runs
    const latestRun = await trackingResultsRepository.findLatestCompletedRunCommit();

    if (!latestRun) {
      return { runId: null, results: [] };
    }

    return { runId: latestRun.runId, results: await trackingResultsRepository.findTermsResultsAt(latestRun.sha, filter) };
  }

  function paginate({ runId, results }, { limit, offset }) {
    return {
      runId, // Identifies the completed run the page reflects, so that consumers paginating through the list can tell when a run completed between two pages and start over
      data: results.slice(offset, offset + limit).map(toResponse),
      count: results.length,
      limit,
      offset,
    };
  }

  /**
   * @private
   * @swagger
   * /tracking-results:
   *   get:
   *     summary: Get the tracking status of all terms.
   *     tags: [Tracking results]
   *     produces:
   *       - application/json
   *     parameters:
   *       - in: query
   *         name: status
   *         description: Only return the tracking results with this status.
   *         schema:
   *           type: string
   *           enum: [ok, failed]
   *         required: false
   *       - $ref: '#/components/parameters/TrackingResultsLimitParam'
   *       - $ref: '#/components/parameters/TrackingResultsOffsetParam'
   *     responses:
   *       200:
   *         description: A JSON object containing the list of tracking results and metadata. The list is empty until a first tracking run completes.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedTrackingResultsResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   */
  router.get('/tracking-results', async (req, res) => {
    const { status } = req.query;
    const { limit, offset } = parsePaginationParams(req.query);
    const validationError = validatePaginationParams(limit, offset);

    if (validationError) {
      return res.status(400).json(validationError);
    }

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status parameter. Must be one of "${VALID_STATUSES.join('", "')}".` });
    }

    const { runId, results } = await findTermsResults();

    return res.status(200).json(paginate({ runId, results: status === undefined ? results : results.filter(result => result.status === status) }, { limit, offset }));
  });

  /**
   * @private
   * @swagger
   * /tracking-results/run:
   *   get:
   *     summary: Get the summary of the latest completed tracking run.
   *     tags: [Tracking results]
   *     produces:
   *       - application/json
   *     responses:
   *       200:
   *         description: A JSON object describing the latest completed tracking run.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TrackingRun'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  router.get('/tracking-results/run', async (req, res) => {
    const latestRun = await trackingResultsRepository.findLatestCompletedRunCommit();

    if (!latestRun) {
      return res.status(404).json({ error: 'No tracking run has completed yet' });
    }

    return res.status(200).json(await trackingResultsRepository.findRunAt(latestRun.sha));
  });

  /**
   * @private
   * @swagger
   * /tracking-result/{serviceId}:
   *   get:
   *     summary: Get the tracking status of all terms of a service.
   *     tags: [Tracking results]
   *     produces:
   *       - application/json
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         description: The ID of the service whose tracking results will be returned.
   *         schema:
   *           type: string
   *         required: true
   *       - $ref: '#/components/parameters/TrackingResultsLimitParam'
   *       - $ref: '#/components/parameters/TrackingResultsOffsetParam'
   *     responses:
   *       200:
   *         description: A JSON object containing the list of tracking results of the service and metadata.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PaginatedTrackingResultsResponse'
   *       400:
   *         $ref: '#/components/responses/BadRequestError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  router.get('/tracking-result/:serviceId', async (req, res) => {
    const { serviceId } = req.params;
    const { limit, offset } = parsePaginationParams(req.query);
    const validationError = validatePaginationParams(limit, offset);

    if (validationError) {
      return res.status(400).json(validationError);
    }

    const { runId, results } = await findTermsResults({ serviceId });

    if (!results.length) {
      return res.status(404).json({ error: `No tracking results found for service "${serviceId}"` });
    }

    return res.status(200).json(paginate({ runId, results }, { limit, offset }));
  });

  /**
   * @private
   * @swagger
   * /tracking-result/{serviceId}/{termsType}:
   *   get:
   *     summary: Get the tracking status of some terms of a service.
   *     tags: [Tracking results]
   *     produces:
   *       - application/json
   *     parameters:
   *       - in: path
   *         name: serviceId
   *         description: The ID of the service whose tracking result will be returned.
   *         schema:
   *           type: string
   *         required: true
   *       - in: path
   *         name: termsType
   *         description: The type of terms whose tracking result will be returned.
   *         schema:
   *           type: string
   *         required: true
   *     responses:
   *       200:
   *         description: A JSON object containing the tracking result.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TrackingResult'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  router.get('/tracking-result/:serviceId/:termsType', async (req, res) => {
    const { serviceId, termsType } = req.params;
    const latestRun = await trackingResultsRepository.findLatestCompletedRunCommit();
    const result = latestRun && await trackingResultsRepository.findTermsResultAt(latestRun.sha, serviceId, termsType);

    if (!result) {
      return res.status(404).json({ error: `No tracking result found for service "${serviceId}" and terms type "${termsType}"` });
    }

    return res.status(200).json(toResponse(result));
  });

  return router;
}
