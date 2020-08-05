export function removeHelpButtons(document) {
  const imgs = document.querySelectorAll('._254').forEach(img => img.remove());
}
export function removeReturnToTopButtons(document) {
  document.querySelectorAll('._t3o').forEach(element => element.remove());
}

export function cleanUrls(document) {
  const links = document.querySelectorAll('[href*="https://l.facebook.com/l.php?"],[href*="http://l.facebook.com/l.php?"]');

  links.forEach(link => {
    link.href = link.href.replace(/&h=\S*/, '');
  });
}
