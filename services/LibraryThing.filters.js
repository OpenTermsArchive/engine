export function selectOnlyTOS(document) {
  const sectionTitles = Array.from(document.querySelectorAll('h2'));
  const privacyPolicyTitle = sectionTitles.filter(el => el.textContent === 'Privacy Policy')[0].firstChild;
  const TermsOfServiceTitle = sectionTitles.filter(el => el.textContent === 'Terms of Service')[0].firstChild;
  const mobilePrivacyPolicyTitle = Array.from(document.querySelectorAll('h3')).filter(title => title.textContent == 'Mobile Apps (Android and iOS)')[0];

  const privacyPolicyContent = document.createRange();
  privacyPolicyContent.setStartBefore(privacyPolicyTitle);
  privacyPolicyContent.setEndBefore(TermsOfServiceTitle);
  privacyPolicyContent.deleteContents();

  const mobilePrivacyPolicyContent = document.createRange();
  mobilePrivacyPolicyContent.setStartBefore(mobilePrivacyPolicyTitle);
  mobilePrivacyPolicyContent.setEndBefore(document.querySelector('.content > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > *:last-child'));
  mobilePrivacyPolicyContent.deleteContents();
}

export function selectOnlyPrivacyPolicy(document) {
  const sectionTitles = Array.from(document.querySelectorAll('h2'));
  const communityRulesTitle = sectionTitles.filter(el => el.textContent === 'Community Rules')[0].firstChild;
  const mobilePrivacyPolicyTitle = Array.from(document.querySelectorAll('h3')).filter(title => title.textContent == 'Mobile Apps (Android and iOS)')[0];
  const lastTitle = sectionTitles.filter(el => el.textContent === 'Tired, yet?\n\n')[0].firstChild;

  const communityRulesContent = document.createRange();
  communityRulesContent.setStartBefore(communityRulesTitle);
  communityRulesContent.setEndBefore(mobilePrivacyPolicyTitle);
  communityRulesContent.deleteContents();

  const otherContent = document.createRange();
  otherContent.setStartBefore(lastTitle);
  otherContent.setEndBefore(document.querySelector('.content > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > *:last-child'));
  otherContent.deleteContents();
}
