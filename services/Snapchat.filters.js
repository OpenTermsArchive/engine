export function selectOnlyEuropeanTOS(document) {
  const USJuridictionContent = document.createRange();
  const firstElement = document.querySelector('.textarticle-container > *:first-child');
  const EuropeanTitle = document.querySelector('#terms-row');
  USJuridictionContent.setStartBefore(firstElement);
  USJuridictionContent.setEndBefore(EuropeanTitle);
  USJuridictionContent.deleteContents();
}
