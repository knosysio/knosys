const reRefDefStr = '\\[([^\\[\\]\\b\\n]+)\\]: ([^\\[\\]\\b\\n]+)';
const reRefDef = new RegExp(reRefDefStr, 'g');
// const reRefDefPart = new RegExp(reRefDefStr);

function replaceRefDefsWith(content, replacer) {
  return content.replace(reRefDef, replacer);
}

function downgradeHeadingLevel(copiedContent, step = 1) {
  return copiedContent.replace(/\# .+/g, matched => `${'#'.repeat(step)}${matched}`)
}

module.exports = { replaceRefDefsWith, downgradeHeadingLevel };
