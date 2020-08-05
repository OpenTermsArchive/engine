export function removeNotDisplayedElements(document) {
  document.querySelectorAll('[style="display: none;"]').forEach(element => element.remove());
}
export function removeBanner(document){
	document.querySelector('.ap01-breadcrumb').remove();
}
export function removeScripts(document){
	document.querySelectorAll('script').forEach(element => element.remove());
}