const { isPlainObject } = require('@ntks/toolbox');

const { resolvePathFromRootRelative, getConfig } = require('../../sdk-core');
const { DEFAULT_SITE_NAME, DEFAULT_SSG_TYPE } = require('../../sdk-site');
const { generateJekyllData } = require('../../sdk-site/generators/jekyll');
const { generateHexoData } = require('../../sdk-site/generators/hexo');

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
