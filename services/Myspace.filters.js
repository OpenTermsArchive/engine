export function numberListCorrectly(document) {
    document.querySelectorAll('ol')
        .forEach(listToClean => Array.from(listToClean.children)
            .filter(element => element.tagName != 'LI')
            .map(element => element.remove()));
}
