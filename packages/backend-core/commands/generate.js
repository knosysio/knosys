const { DEFAULT_SITE_NAME, DEFAULT_SSG_TYPE } = require('../constants');
const { resolvePathFromRootRelative, getConfig } = require('../utils');
const { generateJekyllData } = require('../generators/jekyll');

module.exports = {
  execute: (site = DEFAULT_SITE_NAME) => {
    const { source, data, generator = DEFAULT_SSG_TYPE } = getConfig(`site.${site}`);

    if (generator === 'jekyll') {
      generateJekyllData(resolvePathFromRootRelative(source), resolvePathFromRootRelative(data));
    }
  },
};
