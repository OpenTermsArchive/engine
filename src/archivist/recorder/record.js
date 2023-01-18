export default class Record {
  #content;

  static REQUIRED_PARAMS = Object.freeze([ 'serviceId', 'termsType', 'mimeType', 'fetchDate' ]);

  constructor(params) {
    Record.validate(params);

    Object.assign(this, Object.fromEntries(Object.entries(params)));

    if (params.content) {
      this.#content = params.content;
    }
  }

  get content() {
    if (this.#content === undefined) {
      throw new Error('Record content not defined, set the content or use Repository#loadRecordContent');
    }

    return this.#content;
  }

  set content(content) {
    this.#content = content;
  }

  static validate(givenParams) {
    for (const param of Record.REQUIRED_PARAMS) {
      if (!Object.prototype.hasOwnProperty.call(givenParams, param) || givenParams[param] == null) {
        throw new Error(`"${param}" is required`);
      }
    }
  }
}
