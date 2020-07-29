export function selectOnlyEuropeanTOS(document) {
  const firstElement = document.querySelector('article > *:first-child')
  const titleEuropean = document.querySelector('#terms-eea');
  const titleIndia = document.querySelector('#terms-in')
  const lastElement = document.querySelector('article > *:last-child')

  const range1 = document.createRange();
  range1.setStartBefore(firstElement);
  range1.setEndBefore(europeanSectionTitle);
  range1.deleteContents();

  const range2 = document.createRange();
  range2.setStartBefore(titleIndia);
  range2.setEndBefore(lastElement);
  range2.deleteContents();
}
export function selectOnlyEuropeanPrivacyPolicy(document) {
  const firstElement = document.querySelector('article > *:first-child')
  const titleEuropean = document.querySelector('#privacy-eea');
  const titleIndia = document.querySelector('#privacy-in')
  const lastElement = document.querySelector('article > *:last-child')

  const range1 = document.createRange();
  range1.setStartBefore(firstElement);
  range1.setEndBefore(europeanSectionTitle);
  range1.deleteContents();

  const range2 = document.createRange();
  range2.setStartBefore(titleIndia);
  range2.setEndBefore(lastElement);
  range2.deleteContents();
}
