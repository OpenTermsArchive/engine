export function selectOnlyEuropeanTOS(document) {
  const firstElement = document.querySelector('article > *:first-child');
  const EuropeanTitle = document.querySelector('#terms-eea');
  const IndiaTitle = document.querySelector('#terms-in');
  const lastElement = document.querySelector('article > *:last-child');

  const USJuridictionContent = document.createRange();
  USJuridictionContent.setStartBefore(firstElement);
  USJuridictionContent.setEndBefore(EuropeanTitle);
  USJuridictionContent.deleteContents();

  const IndiaJuridictionContent = document.createRange();
  IndiaJuridictionContent.setStartBefore(IndiaTitle);
  IndiaJuridictionContent.setEndAfter(lastElement);
  IndiaJuridictionContent.deleteContents();
}
export function selectOnlyEuropeanPrivacyPolicy(document) {
  const firstElement = document.querySelector('article > *:first-child');
  const EuropeanTitle = document.querySelector('#privacy-eea');
  const otherJuridictionsTitle = document.querySelector('#privacy-row');
  const lastElement = document.querySelector('article > *:last-child');

  const USJuridictionContent = document.createRange();
  USJuridictionContent.setStartBefore(firstElement);
  USJuridictionContent.setEndBefore(EuropeanTitle);
  USJuridictionContent.deleteContents();

  const othersJuridictionContent = document.createRange();
  othersJuridictionContent.setStartBefore(otherJuridictionsTitle);
  othersJuridictionContent.setEndAfter(lastElement);
  othersJuridictionContent.deleteContents();
}
