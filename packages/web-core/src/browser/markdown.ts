import MarkdownIt from 'markdown-it';
import type { Attachment } from '../contracts/index';

export function renderMarkdown(content: string, attachments: Attachment[], attachmentUrl: (id: string) => string): string {
  const markdown: MarkdownIt = new MarkdownIt({ html: false, linkify: false, breaks: true });
  const resolve = (value: string, image: boolean): string | undefined => {
    if (!image && /^(https?:\/\/|mailto:)/i.test(value)) return value;
    if (!image && /^#[a-zA-Z0-9_-]*$/.test(value)) return value;
    if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('/') || value.includes('\\')) return undefined;
    let decoded: string;
    try { decoded = decodeURIComponent(value.split('#')[0]); } catch { return undefined; }
    const normalized: string = decoded.replace(/^\.\//, '');
    const attachment: Attachment | undefined = attachments.find((item: Attachment): boolean => item.relativePath === normalized);
    return attachment ? attachmentUrl(attachment.id) : undefined;
  };
  markdown.validateLink = (url: string): boolean => !/^(javascript|vbscript|data|file):/i.test(url);
  markdown.renderer.rules.link_open = (tokens, index, options, _environment, renderer): string => {
    const token = tokens[index];
    const url: string | undefined = resolve(token.attrGet('href') || '', false);
    token.attrSet('href', url || '#'); token.attrSet('rel', 'noopener noreferrer');
    return renderer.renderToken(tokens, index, options);
  };
  const defaultImage = markdown.renderer.rules.image!;
  markdown.renderer.rules.image = (tokens, index, options, environment, renderer): string => {
    const url: string | undefined = resolve(tokens[index].attrGet('src') || '', true);
    if (!url) return markdown.utils.escapeHtml(tokens[index].content);
    tokens[index].attrSet('src', url);
    return defaultImage(tokens, index, options, environment, renderer);
  };
  return markdown.render(content);
}
