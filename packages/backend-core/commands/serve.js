const { DEFAULT_SITE_NAME, DEFAULT_SSG_TYPE } = require('../constants');
const { resolvePathFromRootRelative, getConfig } = require('../utils');
const { serveJekyllSite } = require('../generators/jekyll');

module.exports = {
  execute: (site = DEFAULT_SITE_NAME) => {
    const { source, generator = DEFAULT_SSG_TYPE } = getConfig(`site.${site}`);

    if (generator === 'jekyll') {
      serveJekyllSite(resolvePathFromRootRelative(source));
    }
  },
};
