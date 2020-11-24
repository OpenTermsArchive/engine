export function removeHeaderAnchors(document) {
  document.querySelectorAll('[data-toggle="collapse"]').forEach(el => el.replaceWith(el.text));
}
