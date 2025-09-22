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
