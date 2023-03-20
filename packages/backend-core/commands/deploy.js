const { resolvePathFromRootRelative, getConfig, deploySite } = require('../utils');
const { generateJekyllSite } = require('../generators/jekyll');

module.exports = {
  execute: (site = 'default') => {
    const config = getConfig(`site.${site}`);
    const { source, generator = 'jekyll' } = config;

    let siteGenerator;

    if (generator === 'jekyll') {
      siteGenerator = distPath => generateJekyllSite(resolvePathFromRootRelative(source), distPath);
    }

    deploySite(site, config, siteGenerator)
  },
};
