import dotenv from 'dotenv';

import rss from './rss.js';
import sendinblue from './sendinblue.js';

dotenv.config();

export default {
  rss,
  sendinblue
};
