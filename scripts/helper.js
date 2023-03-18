const { resolve: resolvePath } = require('path');
const { readFileSync } = require('fs');

const ROOT_PATH = resolvePath(__dirname, '../');
const SITE_PATH = `${ROOT_PATH}/sites/homepage`;

const configFilePath = `${ROOT_PATH}/.knosysrc`;

function getConfig(key) {
  const config = JSON.parse(readFileSync(configFilePath, 'utf8').toString().trim());

  return key ? config[key] : config;
}

module.exports = {
  ROOT_PATH,
  SITE_PATH,
  getConfig,
  ...require(resolvePath(ROOT_PATH, getConfig('path'))),
};
