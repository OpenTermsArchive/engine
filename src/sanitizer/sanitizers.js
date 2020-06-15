export function cleanFacebookUrls(document) {
  const links = document.querySelectorAll('[href*="https://l.facebook.com/l.php?"]');
  links.forEach(link => {
    link.href = link.href.replace(/&h=\S*/, '');
  });
}
