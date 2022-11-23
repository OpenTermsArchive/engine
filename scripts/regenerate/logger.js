import colorsLib from 'colors';

export const logColors = {
  debug: colorsLib.grey,
  info: colorsLib.cyan,
  error: colorsLib.red,
  warn: colorsLib.yellow,
};

export const colors = colorsLib;

export default {
  debug: (...args) => console.log(logColors.debug(...args)),
  info: (...args) => console.log(logColors.info(...args)),
  error: (...args) => console.log(logColors.error(...args)),
  warn: (...args) => console.log(logColors.warn(...args)),
};
