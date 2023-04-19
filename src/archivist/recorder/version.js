import mime from 'mime';

import Record from './record.js';

export default class Version extends Record {
  static REQUIRED_PARAMS = Object.freeze([ ...Record.REQUIRED_PARAMS, 'snapshotIds' ]);

  static SOURCE_DOCUMENTS_SEPARATOR = '\n\n';

  constructor(params) {
    super(params);
    this.mimeType = mime.getType('markdown');
  }
}
