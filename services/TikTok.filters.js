export function selectOnlyEuropeanTOS(document) {
  //Select titles for juridictions
	const titleAmerican = document.querySelector('#terms-us');
	const titleEuropean = document.querySelector('#terms-eea');
	const titleIndia =  document.querySelector('#terms-in')
  //Delete useless paragraphs
	let currentNode = titleAmerican.previousElementSibling;
	while(currentNode){
		let toRemove = currentNode;
		currentNode = currentNode.previousElementSibling;
		toRemove.remove();
	}
  //Delete others jurisdictions
	currentNode = titleAmerican;
	while(currentNode != titleEuropean){
		let toRemove = currentNode;
		currentNode = currentNode.nextElementSibling;
		toRemove.remove();
	}
	currentNode = titleIndia;
	while(currentNode){
		let toRemove = currentNode;
		currentNode = currentNode.nextElementSibling;
		toRemove.remove();
	}
}
export function selectOnlyEuropeanPrivacyPolicy(document) {
  //Select titles for juridictions
	const titleAmerican = document.querySelector('#privacy-us');
	const titleEuropean = document.querySelector('#privacy-eea');
	const titleOther = document.querySelector('#privacy-row')
  //Delete useless paragraphs
	let currentNode = titleAmerican.previousElementSibling;
	while(currentNode){
		let toRemove = currentNode;
		currentNode = currentNode.previousElementSibling;
		toRemove.remove();
	}
  //Delete others jurisdictions
	currentNode = titleAmerican;
	while(currentNode != titleEuropean){
		let toRemove = currentNode;
		currentNode = currentNode.nextElementSibling;
		toRemove.remove();
	}
	currentNode = titleOther;
	while(currentNode){
		let toRemove = currentNode;
		currentNode = currentNode.nextElementSibling;
		toRemove.remove();
	}
}