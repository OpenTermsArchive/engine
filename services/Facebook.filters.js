export function removeHelpButtons(document) {
  const imgs = document.querySelectorAll('img[src*="https://scontent"]');

  imgs.forEach(img => {
    const parent = img.parentNode;

    if (parent.tagName === 'A' && !parent.text) {
      parent.remove();
    }
  });
}

export function removeImgFromCookiesPolicy(document) {
  document.querySelector('._vpi').remove();
}

export function removeReturnToTopButtons(document) {
  document.querySelectorAll('._t3o').forEach(element => element.remove());
}
export function cleanUrls(document) {
  Array.from(document.querySelectorAll('[href="#"]')).map(link => link.removeAttribute('href'));
  const links = document.querySelectorAll('[href*="https://l.facebook.com/l.php?"],[href*="http://l.facebook.com/l.php?"]');

  links.forEach(link => {
    link.href = decodeURIComponent(link.href.replace(/&h=\S*/, '').replace(/(\S*)\?u=(\S*)/, '$2'));
  });
}

export function numberListCorrectly(document) {
  document.querySelectorAll('ol').forEach(listToClean =>
    Array.from(listToClean.children)
      .filter(element => element.tagName !== 'LI' && element.tagName !== 'OL')
      .map(element => element.remove()));

  Array.from(document.querySelectorAll('ol > ol')).map(element => element.previousSibling.appendChild(element));
}
