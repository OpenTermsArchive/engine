import logger from '../logger.js';

export default function errorsMiddleware(err, req, res, next) {
  logger.error(err.stack);

  if (res.headersSent) { // A response that already started cannot be restarted with a JSON error; defer to Express' default handler, which ends the request instead of leaving the client waiting
    return next(err);
  }

  res.status(500).json({ error: 'Internal Server Error' }); // Never echo internal error details: they can expose server internals such as filesystem paths
}
