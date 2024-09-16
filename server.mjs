import { createServer } from 'http';

import { handler } from './server-common.mjs';

const port = 3000;
createServer(handler).listen(port);
console.log(`listening on port ${port}`);
