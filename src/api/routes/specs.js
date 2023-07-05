import express from 'express';

const router = express.Router();

export default function specsRouter(specs) {
  router.get('/', (req, res) => {
    res.json(specs);
  });

  return router;
}
