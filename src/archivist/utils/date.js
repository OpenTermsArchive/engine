export function toISODateWithoutMilliseconds(date) {
  return new Date(date).toISOString().replace(/\.\d+/, '');
}
