export function removeUTMfromUrls(document) {
  const links = document.querySelectorAll('a');
  links.forEach(link => {
    link.href = link.href.replace(/utm_[^=]*=[^&]*[&]{0,1}/g, '');
  });
}

export function removeCountryVersion(document) {
  const countryVersionLink = document.querySelector('a[data-name="country-version"]');
  const countryVersionTitle = document.querySelector('#footnote-country-version');
  const disclaimerTitle = document.querySelector('#footnote-disclaimer');

  if (countryVersionLink) {
    // Remove "country version" link at top of the page
    countryVersionLink.parentNode.remove();
  }

  if (countryVersionTitle && disclaimerTitle) {
    // Remove all the "country version" section in the CGUs
    const countryVersionSectionContent = document.createRange();
    countryVersionSectionContent.setStartBefore(countryVersionTitle);
    countryVersionSectionContent.setEndBefore(disclaimerTitle);
    countryVersionSectionContent.deleteContents();
  }
}
