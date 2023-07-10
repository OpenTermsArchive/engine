import path from 'path';
import { fileURLToPath } from 'url';

import express from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function specsRouter(basePath) {
  const router = express.Router();
  const specs = swaggerJsdoc({
    definition: {
      openapi: '3.1.0',
      info: {
        title: 'Open Terms Archive API',
        version: '1.0.0',
        license: {
          name: 'EUPL-1.2',
          url: 'https://eupl.eu/1.2/',
        },
      },
      servers: [{ url: basePath }],
    },
    apis: [`${__dirname}/*.js`],
  });

  router.use('/docs', swaggerUi.serve);
  router.get('/docs', (req, res) => {
    if (req.get('Accept')?.match('json')) {
      return res.json(specs);
    }

    return swaggerUi.setup(specs)(req, res);
  });

  return router;
}
