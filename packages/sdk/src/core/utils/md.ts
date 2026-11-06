import mdit from 'markdown-it';
import matter from 'gray-matter';
import { last, pick } from '../../compat/utils';

const md = new mdit();

export function resolveTitle(content: string): string[] | undefined {
  const tokens = md.parse(content, {});
  const found: string[][] = [];

  let open = false;
  let sep: string[] = [];

  tokens.forEach(token => {
    if (token.tag === 'h1') {
      open = token.type === 'heading_open';

      if (!open) {
        found.push(sep);
        sep = [];
      }
    } else if (open) {
      sep.push(token.content);
    }
  });

  return last(found);
}

export function normalizeFrontMatter(content: string): { data: any; content: string } {
  const resolved = pick(matter(content), ['data', 'content']) as { data: any; content: string };
  const titleFromContent = resolveTitle(resolved.content);

  if (titleFromContent) {
    resolved.data.title = titleFromContent.join('\n');
    resolved.content = resolved.content.replace(/^#\s+.*$/gm, '').trim();
  }

  if (Object.keys(resolved.data).length === 0) {
    resolved.data = null;
  }

  return resolved;
}

export const reRefDefStr = '\\[([^\\[\\]\\b\\n]+)\\]: ([^\\[\\]\\b\\n]+)';
export const reRefDef = new RegExp(reRefDefStr, 'g');

/**
 * Replace reference definitions in markdown content
 */
export function replaceRefDefsWith(content: string, replacer: (match: string, p1: string, p2: string) => string): string {
  return content.replace(reRefDef, replacer);
}

/**
 * Downgrade heading level in markdown content
 */
export function downgradeHeadingLevel(copiedContent: string, step: number = 1): string {
  return copiedContent.replace(/\# .+/g, matched => `${'#'.repeat(step)}${matched}`);
}
