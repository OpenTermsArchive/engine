export function selectOnlyTOS(document) {
	const h2Titles = document.querySelectorAll("h2");
	const titlePP = h2Titles[0];
	const titleTOS = h2Titles[2];
	const titleMobilePP = Array.from(document.querySelectorAll("h3")).filter(title => title.textContent == "Mobile Apps (Android and iOS)")[0];

	let currentNode = titlePP;
	while(currentNode != titleTOS){
		let toRemove = currentNode;
		currentNode = currentNode.nextSibling;
		toRemove.remove();
	}
	currentNode = titleMobilePP;
	while(currentNode){
		let toRemove = currentNode;
		currentNode = currentNode.nextSibling;
		toRemove.remove();
	}
}

export function selectOnlyPrivacyPolicy(document){
	const h2Titles = document.querySelectorAll("h2");
	const titleCR = h2Titles[1];
	const titleMobilePP = Array.from(document.querySelectorAll("h3")).filter(title => title.textContent == "Mobile Apps (Android and iOS)")[0];
	const titleLast = h2Titles[3];
	let currentNode = titleCR;
	while(currentNode != titleMobilePP){
		let toRemove = currentNode;
		currentNode = currentNode.nextSibling;
		toRemove.remove();
	}
	currentNode = titleLast;
	while(currentNode){
		let toRemove = currentNode;
		currentNode = currentNode.nextSibling;
		toRemove.remove();
	}
}