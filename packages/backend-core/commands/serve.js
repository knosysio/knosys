const { resolvePathFromRootRelative, getConfig } = require('../utils');
const { serveJekyllSite } = require('../generators/jekyll');

module.exports = {
  execute: (site = 'default') => {
    const { source, generator = 'jekyll' } = getConfig(`site.${site}`);

    if (generator === 'jekyll') {
      serveJekyllSite(resolvePathFromRootRelative(source));
    }
  },
};
