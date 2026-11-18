import ciceroMark from '@accordproject/markdown-cicero';
import mardownPdf from '@accordproject/markdown-pdf';
import turndownPluginGithubFlavouredMarkdown from 'joplin-turndown-plugin-gfm';
import TurndownService from 'turndown';

const TEXT_NODE = 3;
const MEANINGLESS_WRAPPERS_SELECTOR = 'span, font'; // Inline elements that have no Markdown equivalent: only their content is converted
const REDUNDANT_EMPHASIS_SELECTOR = 'strong strong, strong b, b strong, b b, em em, em i, i em, i i'; // Bold inside bold and italic inside italic do not change the rendering, whereas Markdown reads their adjacent delimiters as another emphasis
const NESTING_RANKS = { EM: 0, I: 0, STRONG: 1, B: 1, A: 2 }; // Order in which italic, bold and links are nested when they wrap the same content, from the innermost to the outermost

const turndownService = new TurndownService();

turndownService.use(turndownPluginGithubFlavouredMarkdown.gfm);

turndownService.addRule('fix-anchors-containing-block-elements', {
  ...turndownService.options.rules.inlineLink,
  replacement: (content, node) => turndownService.options.rules.inlineLink.replacement(content.trim(), node),
});

[ 'strong', 'emphasis' ].forEach(rule => {
  turndownService.addRule(`move-line-breaks-outside-${rule}`, { // Markdown renders bold and italic only if their delimiters are next to the text, so the line breaks that blocks and `br` elements add at the edges of the content are moved outside the delimiters
    ...turndownService.options.rules[rule],
    replacement: (content, node, options) => {
      const text = content.trim();

      if (!text) {
        return '';
      }

      const leadingLineBreaks = content.slice(0, content.length - content.trimStart().length);
      const trailingLineBreaks = content.slice(content.trimEnd().length);

      return `${leadingLineBreaks}${turndownService.options.rules[rule].replacement(text, node, options)}${trailingLineBreaks}`;
    },
  });
});

const { PdfTransformer } = mardownPdf;
const { CiceroMarkTransformer } = ciceroMark;
const ciceroMarkTransformer = new CiceroMarkTransformer();

export function transformFromHTML(html) {
  return turndownService.turndown(canonicalizeMarkup(html));
}

export async function transformFromPDF(pdfBuffer) {
  try {
    const ciceroMarkdown = await PdfTransformer.toCiceroMark(pdfBuffer);

    return ciceroMarkTransformer.toMarkdown(ciceroMarkdown);
  } catch (error) {
    if (error.parserError) {
      throw new Error("Can't parse PDF file");
    }
    throw error;
  }
}

function canonicalizeMarkup(dom) { // Some websites serve, from one fetch to the next, markup variations that render the same; they have to result in the same Markdown to avoid recording versions without any change in the content
  dom.querySelectorAll(`${MEANINGLESS_WRAPPERS_SELECTOR}, ${REDUNDANT_EMPHASIS_SELECTOR}`).forEach(unwrap);
  removeComments(dom);
  [...dom.querySelectorAll('em, i, strong, b')].reverse().forEach(sortNesting); // Innermost elements first, so that each one is sorted against an already sorted content
  dom.normalize(); // Merge the adjacent text nodes left by the previous steps, as Turndown escapes Markdown syntax according to the position of the characters in their text node

  return dom;
}

function removeComments(dom) {
  const { ownerDocument } = dom;
  const walker = ownerDocument.createTreeWalker(dom, ownerDocument.defaultView.NodeFilter.SHOW_COMMENT);
  const comments = [];

  for (let comment = walker.nextNode(); comment; comment = walker.nextNode()) {
    comments.push(comment);
  }

  comments.forEach(comment => comment.remove());
}

function unwrap(element) {
  element.replaceWith(...element.childNodes);
}

function sortNesting(element) { // `<strong><a>text</a></strong>` and `<a><strong>text</strong></a>` render the same, as do `<em><strong>text</strong></em>` and `<strong><em>text</em></strong>`; the latter of each is kept, links being the outermost as Markdown does not render an emphasis around a link that is adjacent to a word or to another emphasis
  for (let wrapped = getWrappedElement(element); NESTING_RANKS[wrapped?.nodeName] > NESTING_RANKS[element.nodeName]; wrapped = getWrappedElement(element)) {
    unwrap(wrapped);
    element.replaceWith(wrapped);
    wrapped.append(element);
  }
}

function getWrappedElement(element) { // The only child of the given element, whitespace aside
  const significantNodes = [...element.childNodes].filter(node => node.nodeType != TEXT_NODE || node.nodeValue.trim());

  return significantNodes.length == 1 ? significantNodes[0] : null;
}
