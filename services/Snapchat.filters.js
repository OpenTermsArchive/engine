export function selectOnlyEuropeanTOS(document) {
  const range = document.createRange();
  const firstElement = document.querySelector('.textarticle-container > *:first-child');
  const europeanSectionTitle = document.querySelector('#terms-row');
  range.setStartBefore(firstElement);
  range.setEndBefore(europeanSectionTitle);
  range.deleteContents();
}
