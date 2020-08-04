export function removeNotDisplayedElements(document) {
  document.querySelectorAll('[style="display: none;"]').forEach(element => element.remove());
}
