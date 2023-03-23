const { DEFAULT_SITE_NAME, DEFAULT_SSG_TYPE } = require('../constants');
const { resolvePathFromRootRelative, getConfig, deploySite } = require('../utils');
const { copyJekyllTheme, serveJekyllSite, generateJekyllSite } = require('../generators/jekyll');

module.exports = {
  execute: (subCmd, site = DEFAULT_SITE_NAME) => {
    const config = getConfig(`site.${site}`);
    const { source, theme, generator = DEFAULT_SSG_TYPE } = config;

    let copier;
    let server;
    let deployer;

    if (generator === 'jekyll') {
      copier = copyJekyllTheme;
      server = serveJekyllSite;
      deployer = generateJekyllSite;
    }

    const srcPath = resolvePathFromRootRelative(source);

    if (subCmd === 'copy') {
      if (copier && theme) {
        copier(srcPath, resolvePathFromRootRelative(theme));
      }
    } else if (subCmd === 'serve') {
      if (server) {
        server(srcPath);
      }
    } else if (subCmd === 'deploy') {
      let siteGenerator;

      if (deployer) {
        siteGenerator = distPath => deployer(srcPath, distPath);
      }

      deploySite(site, config, siteGenerator)
    }
  },
};
