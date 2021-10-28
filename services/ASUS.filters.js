export function removeSecurityUpdates(document) {
  const aTags = document.getElementsByTagName('h3');
  const searchText = 'Latest security updates';
  let found;

  for (let i = 0; i < aTags.length; i++) {
    if (aTags[i].textContent == searchText) {
      found = aTags[i];
      break;
    }
  }

  let nextEl = found.nextSibling;

  while (nextEl != null) {
    found.parentNode.removeChild(nextEl);
    nextEl = found.nextSibling;
  }

  found.remove();
}
