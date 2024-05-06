import logger from '../logger.js';

export default function errorsMiddleware(err, req, res, next) {
  logger.error(err.stack);
  res.status(500).json({ error: err.message });
}
