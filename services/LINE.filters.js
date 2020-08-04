export function removeStyleTag(document) {
  document.querySelectorAll('style').forEach(element => element.remove());
}
