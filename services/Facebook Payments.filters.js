export { removeReturnToTopButtons } from './Facebook.filters.js';
export { cleanUrls } from './Facebook.filters.js';
export { numberListCorrectly } from './Facebook.filters.js';

export function removeHelpButtons(document) {
  document.querySelectorAll('._254').forEach(img => img.remove());
}
export function correctTitleIndentation(document) {
  document.querySelectorAll('h3 + ol > *:last-child').forEach(element => {
    element.innerHTML += '<br>';
  });
}
