export async function removeHelpButtons(document, url) {
  const imgs = document.querySelectorAll('img[src*="https://scontent"]');
    imgs.forEach(img => {
      const parent = img.parentNode;
      if (parent.tagName == 'A' && !parent.text) {
        parent.remove();
      }
  });
}
export async function removeReturnToTopButtons(document, url) {
  document.querySelectorAll('._t3o').forEach(element => element.remove());
}

export async function cleanUrls(document, url) {
  const links = document.querySelectorAll('[href*="https://l.facebook.com/l.php?"]');
  links.forEach(link => {
    link.href = link.href.replace(/&h=\S*/, '');
  });
}
