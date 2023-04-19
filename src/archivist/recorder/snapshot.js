import Record from './record.js';

export default class Snapshot extends Record {
  static REQUIRED_PARAMS = Object.freeze([ ...Record.REQUIRED_PARAMS, 'mimeType' ]);
}
