const { DEFAULT_SITE_NAME, DEFAULT_SSG_TYPE } = require('../constants');
const { resolvePathFromRootRelative, getConfig } = require('../utils');
const { generateJekyllData } = require('../generators/jekyll');
const { generateHexoData } = require('../generators/hexo');

const generatorMap = {
  jekyll: generateJekyllData,
  hexo: generateHexoData,
};

module.exports = {
  execute: (site = DEFAULT_SITE_NAME) => {
    const { source, data, generator = DEFAULT_SSG_TYPE } = getConfig(`site.${site}`);
    const dataGen = generatorMap[generator];

    if (dataGen) {
     dataGen(resolvePathFromRootRelative(source), resolvePathFromRootRelative(data));
    }
  },
};
