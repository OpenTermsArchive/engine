export function selectOnlyTOS(document) {
	const sectionTitles = Array.from(document.querySelectorAll('h2'));
	const titlePP = sectionTitles.filter(el => el.textContent === 'Privacy Policy')[0].firstChild;
	const titleTOS = sectionTitles.filter(el => el.textContent === 'Terms of Service')[0].firstChild;
	const titleMobilePP = Array.from(document.querySelectorAll('h3')).filter(title => title.textContent == 'Mobile Apps (Android and iOS)')[0];

	const range1 = document.createRange();
	range1.setStartBefore(titlePP);
	range1.setEndBefore(titleTOS);
	range1.deleteContents();

	const range2 = document.createRange();
	range2.setStartBefore(titleMobilePP);
	range2.setEndBefore(document.querySelector('.content > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > *:last-child'));
	range2.deleteContents();
}

export function selectOnlyPrivacyPolicy(document) {
	const sectionTitles = Array.from(document.querySelectorAll('h2'));
	const titleCR = sectionTitles.filter(el => el.textContent === 'Community Rules')[0].firstChild;
	const titleMobilePP = Array.from(document.querySelectorAll('h3')).filter(title => title.textContent == 'Mobile Apps (Android and iOS)')[0];
	const titleLast = sectionTitles.filter(el => el.textContent === 'Tired, yet?\n\n')[0].firstChild;

	const range1 = document.createRange();
	range1.setStartBefore(titleCR);
	range1.setEndBefore(titleMobilePP);
	range1.deleteContents();

	const range2 = document.createRange();
	range2.setStartBefore(titleLast);
	range2.setEndBefore(document.querySelector('.content > table:nth-child(1) > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > *:last-child'));
	range2.deleteContents();
}