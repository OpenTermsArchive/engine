import { createServer } from 'http';

import config from 'config';

import Archivist from './src/archivist/index.js';

createServer(async (req, res) => {
  // eslint-disable-next-line no-unused-vars
  let body = '';

  req.on('data', chunk => {
    body += chunk;
  });
  req.on('end', async () => {
    res.write(body);
    const options = JSON.parse(body);

    console.log(options);

    const archivist = new Archivist({
      recorderConfig: config.get('@opentermsarchive/engine.recorder'),
      fetcherConfig: config.get('@opentermsarchive/engine.fetcher'),
    });

    const results = await archivist.crawl(options);

    res.write(JSON.stringify(results));
    res.end();
  });
}).listen(3000);
console.log('listening on port 3000');
