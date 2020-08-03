
export function removeUTMfromUrls(document) {
  const links = document.querySelectorAll('a');
  links.forEach(link => {
    link.href = link.href.replace(/utm_[^=]*=[^&]*[&]{0,1}/g, '');
  });
}
