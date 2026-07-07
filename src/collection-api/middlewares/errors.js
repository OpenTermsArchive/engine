import logger from '../logger.js';

export default function errorsMiddleware(err, req, res, next) {
  logger.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' }); // Never echo internal error details: they can expose server internals such as filesystem paths
}
