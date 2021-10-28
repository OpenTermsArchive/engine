export function removeBanner(document) {
  document.querySelector('.ap01-breadcrumb').remove();
}
export function removeScripts(document) {
  document.querySelectorAll('script').forEach(element => element.remove());
}
