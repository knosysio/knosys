const { generateSiteData } = require('../utils');

function generateHexoData(srcPath, dataSourcePath) {
  generateSiteData(srcPath, dataSourcePath, { dataDir: 'source/_data', docDir: 'source/knosys' });
}

module.exports = { generateHexoData };
