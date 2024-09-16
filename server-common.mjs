
import config from 'config';

import Archivist from './src/archivist/index.js';

export async function handler (req, res) {
  // eslint-disable-next-line no-unused-vars
  let body = '';
  const header = req.headers.authorization || '';       // get the auth header
  const token = header.split(/\s+/).pop() || '';        // and the encoded auth token
  if (token === process.env.API_SECRET) {
    res.writeHead(401);
    res.end('Please send an Authorization header with the API_SECRET from this script\'s run environment');
  }
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
}