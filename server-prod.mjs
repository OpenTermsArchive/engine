import { createServer } from 'https';
import { readFileSync } from 'fs';

import { handler } from './server-common.mjs';

const options = {
  key: readFileSync('/home/crawler/tls/privkey.pem'),
  cert: readFileSync('/home/crawler/tls/fullchain.pem'),
};

const port = 443;
createServer(options, handler).listen(port);
console.log(`listening on port ${port}`);
