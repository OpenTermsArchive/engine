
export function removeHelpButtons(document) {
  const imgs = document.querySelectorAll('img[src*="https://scontent"]');
    imgs.forEach(img => {
    const parent = img.parentNode;
    if (parent.tagName == 'A' && !parent.text) {
      parent.remove();
    }
  });
}

export function cleanUrls(document) {
  const links = document.querySelectorAll('[href*="https://l.facebook.com/l.php?"]');
  links.forEach(link => {
    link.href = link.href.replace(/&h=\S*/, '');
  });
}
