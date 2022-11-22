import colorsLib from 'colors';

export const colors = {
  debug: colorsLib.grey,
  info: colorsLib.cyan,
  error: colorsLib.red,
  warn: colorsLib.yellow,
  ...colorsLib,
};

export default {
  debug: (...args) => console.log(colors.debug(...args)),
  info: (...args) => console.log(colors.info(...args)),
  error: (...args) => console.log(colors.error(...args)),
  warn: (...args) => console.log(colors.warn(...args)),
};
