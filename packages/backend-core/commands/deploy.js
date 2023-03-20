const { DEFAULT_SITE_NAME, DEFAULT_SSG_TYPE } = require('../constants');
const { resolvePathFromRootRelative, getConfig, deploySite } = require('../utils');
const { generateJekyllSite } = require('../generators/jekyll');

module.exports = {
  execute: (site = DEFAULT_SITE_NAME) => {
    const config = getConfig(`site.${site}`);
    const { source, generator = DEFAULT_SSG_TYPE } = config;

    let siteGenerator;

    if (generator === 'jekyll') {
      siteGenerator = distPath => generateJekyllSite(resolvePathFromRootRelative(source), distPath);
    }

    deploySite(site, config, siteGenerator)
  },
};
