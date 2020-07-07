
export function removeHelpButtons(document) {
  const links = document.querySelectorAll('a[href="#"][id*="-markdown-internal-id"]');
  links.forEach(link => {
    // Helps buttons do not have text content
    if (!link.text) {
      link.remove();
    }
  });
}

export function cleanUrls(document) {
  const links = document.querySelectorAll('[href*="https://l.facebook.com/l.php?"]');
  links.forEach(link => {
    link.href = link.href.replace(/&h=\S*/, '');
  });
}
