/**
 * Abstract Class Record.
 * @class Record
 * @private
 */

export const TITLE_PREFIXES = Object.freeze({
  firstRecord: 'First record of',
  technicalUpgrade: 'Apply technical or declaration upgrade on',
  update: 'Record new changes of',
});

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

  get displayTitle() {
    let prefix;

    if (this.isFirstRecord) {
      prefix = TITLE_PREFIXES.firstRecord;
    } else if (this.isTechnicalUpgrade) {
      prefix = TITLE_PREFIXES.technicalUpgrade;
    } else {
      prefix = TITLE_PREFIXES.update;
    }

    return `${prefix} ${this.serviceId} ${this.termsType}`;
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
