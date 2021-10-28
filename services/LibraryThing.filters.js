export function moveAppPrivacyPolicyIntoGlobalPrivacyPolicy(document) {
  const startOfAppPrivacyPolicy = Array.from(document.querySelectorAll('h3')).filter(title => title.textContent === 'Mobile Apps (Android and iOS)')[0];
  const endOfToS = document.querySelector('[name=coppa] ~ h2');

  const appPrivacyPolicy = document.createRange();

  appPrivacyPolicy.setStartBefore(startOfAppPrivacyPolicy);
  appPrivacyPolicy.setEndBefore(endOfToS);

  const endOfPrivacyPolicy = document.querySelector('[name="#privacy"] ~ h2 ~ h2');

  document
    .querySelector('#lt2_content_interior')
    .insertBefore(appPrivacyPolicy.cloneContents(), endOfPrivacyPolicy);

  appPrivacyPolicy.deleteContents();
}
