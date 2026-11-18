import ciceroMark from '@accordproject/markdown-cicero';
import mardownPdf from '@accordproject/markdown-pdf';
import turndownPluginGithubFlavouredMarkdown from 'joplin-turndown-plugin-gfm';
import TurndownService from 'turndown';

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
  return turndownService.turndown(html);
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
