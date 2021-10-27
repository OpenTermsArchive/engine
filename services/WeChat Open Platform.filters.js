export function convertScriptToDiv(document) {
  const script = document.querySelector('#en_US_tpl');
  const div = document.createElement('div');

  div.innerHTML = script.innerHTML;
  div.id = 'en_US_tpl';
  script.parentNode.replaceChild(div, script);
}
