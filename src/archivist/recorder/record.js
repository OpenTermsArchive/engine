/**
 * Abstract Class Record.
 *
 * @class Record
 */
export default class Record {
  #content;

  static REQUIRED_PARAMS = Object.freeze([ 'serviceId', 'termsType', 'fetchDate', 'content' ]);

  constructor(params) {
    if (this.constructor == Record) {
      throw new Error("Abstract Record class can't be instantiated.");
    }

    Object.assign(this, Object.fromEntries(Object.entries(params)));

    if (params.content) {
      this.#content = params.content;
    }
  }

  get content() {
    if (this.#content === undefined) {
      throw new Error('Content not defined, set the content or use Repository#loadRecordContent');
    }

    return this.#content;
  }

  set content(content) {
    this.#content = content;
  }

  validate() {
    for (const requiredParam of this.constructor.REQUIRED_PARAMS) {
      if (requiredParam == 'content') {
        if (this[requiredParam] == '' || this[requiredParam] == null) {
          throw new Error(`${this.constructor.name} is not valid; "${requiredParam}" is empty or null`);
        }
      } else if (!Object.prototype.hasOwnProperty.call(this, requiredParam) || this[requiredParam] == null) {
        throw new Error(`${this.constructor.name} is not valid; "${requiredParam}" is missing`);
      }
    }
  }
}
