export function removeUTMfromUrls(document) {
  const links = document.querySelectorAll('a');
  links.forEach(link => {
    link.href = link.href.replace(/utm_[^=]*=[^&]*[&]{0,1}/g, '');
  });
}

export function removeCountryVersion(document) {
  // Remove "country version" link at top of the page
  document.querySelector('a[data-name="country-version"]').parentNode.remove();

  // Remove all the "country version" section in the CGUs
  const countryVersionTitle = document.querySelector('#footnote-country-version');
  const disclaimerTitle = document.querySelector('#footnote-disclaimer');

  let node = countryVersionTitle;
  while (node !== disclaimerTitle.previousSibling) {
    const next = node.nextSibling;
    node.remove();
    node = next;
  }
}
