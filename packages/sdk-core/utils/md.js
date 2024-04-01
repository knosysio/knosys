const mdit = require('markdown-it')();
const matter = require('gray-matter');
const { last, pick } = require('@ntks/toolbox');

function resolveTitle(content) {
  const tokens = mdit.parse(content, {});
  const found = [];

  let open = false;
  let sep = [];

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

function normalizeFrontMatter(content) {
  const resolved = pick(matter(content), ['data', 'content']);
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

const reRefDefStr = '\\[([^\\[\\]\\b\\n]+)\\]: ([^\\[\\]\\b\\n]+)';
const reRefDef = new RegExp(reRefDefStr, 'g');
// const reRefDefPart = new RegExp(reRefDefStr);

function replaceRefDefsWith(content, replacer) {
  return content.replace(reRefDef, replacer);
}

function downgradeHeadingLevel(copiedContent, step = 1) {
  return copiedContent.replace(/\# .+/g, matched => `${'#'.repeat(step)}${matched}`)
}

module.exports = { normalizeFrontMatter, replaceRefDefsWith, downgradeHeadingLevel };
