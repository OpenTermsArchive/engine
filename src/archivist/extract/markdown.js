import ciceroMark from '@accordproject/markdown-cicero';
import mardownPdf from '@accordproject/markdown-pdf';
import TurndownService from '@opentermsarchive/turndown';
import turndownPluginGithubFlavouredMarkdown from 'joplin-turndown-plugin-gfm';

const turndownService = new TurndownService();

turndownService.use(turndownPluginGithubFlavouredMarkdown.gfm);

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
