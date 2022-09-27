const reRefDefStr = '\\[([^\\[\\]\\b\\n]+)\\]: ([^\\[\\]\\b\\n]+)';
const reRefDef = new RegExp(reRefDefStr, 'g');
// const reRefDefPart = new RegExp(reRefDefStr);

function replaceRefDefsWith(content, replacer) {
  return content.replace(reRefDef, replacer);
}

module.exports = { replaceRefDefsWith };
