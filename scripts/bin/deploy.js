const { ROOT_PATH, SITE_PATH, getConfig, deploySite, generateJekyllSite } = require('../helper');

module.exports = {
  execute: deploySite.bind(null, 'knosys', getConfig('site').default, distPath => generateJekyllSite(ROOT_PATH, SITE_PATH, distPath)),
};
