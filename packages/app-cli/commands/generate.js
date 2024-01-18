const { isPlainObject } = require('@ntks/toolbox');

const { resolvePathFromRootRelative, getConfig } = require('../../backend-core');
const { DEFAULT_SITE_NAME, DEFAULT_SSG_TYPE } = require('../../backend-site');
const { generateJekyllData } = require('../../backend-site/generators/jekyll');
const { generateHexoData } = require('../../backend-site/generators/hexo');

const generatorMap = {
  jekyll: generateJekyllData,
  hexo: generateHexoData,
};

module.exports = {
  execute: (site = DEFAULT_SITE_NAME, sourceKey = 'default') => {
    const { source, data, generator = DEFAULT_SSG_TYPE } = getConfig(`site.${site}`);
    const dataDir = isPlainObject(data) ? data[sourceKey] : data;
    const dataGen = generatorMap[generator];

    if (dataDir && dataGen) {
      dataGen(resolvePathFromRootRelative(source), resolvePathFromRootRelative(dataDir));
    }
  },
};
