export function selectOnlyEuropeanTOS(document) {
  //Select titles for juridictions
	const titleAmerican = document.querySelector('#terms-us');
	const titleEuropean = document.querySelector('#terms-row');
  //Delete useless paragraph
  titleAmerican.previousElementSibling.previousElementSibling.remove();
  titleAmerican.previousElementSibling.remove();
  //Delete American juridiction
	let currentNode = titleAmerican;
	while(currentNode != titleEuropean){
		let toRemove = currentNode;
		currentNode = currentNode.nextElementSibling;
		toRemove.remove();
	}
}
