const { resolve: resolvePath } = require('path');
const { existsSync } = require('fs');
const { retrieveData, mixin } = require('@ntks/toolbox');

const { GLOBAL_DIR_NAME, LOCAL_DIR_NAME, CONFIG_FILE_NAME } = require('../constants');
const { readData, saveData } = require('./fs');

function getGlobalConfigDirPath() {
  return resolvePath(process.env.HOME || process.env.USERPROFILE, GLOBAL_DIR_NAME);
}

function getConfigFilePath(cwd) {
  const configFilePath = `${cwd}/${CONFIG_FILE_NAME}`;

  return existsSync(configFilePath) ? configFilePath : `${cwd}/${LOCAL_DIR_NAME}/config.json`;
}

/**
 * `root` is somewhere the config file located
 *
 * @returns `root`'s absolute path
 */
function resolveRootPath() {
  let cwd = process.env.INIT_CWD; // will be `undefined` when not called by npm scripts

  if (cwd && !existsSync(getConfigFilePath(cwd))) {
    let currentDirPath = cwd;
    let rootPath;

    do {
      let gitPath = `${currentDirPath}/.git`;
      let configPath = `${currentDirPath}/${CONFIG_FILE_NAME}`;

      if (existsSync(gitPath)) { // treat as project root
        if (existsSync(configPath)) {
          rootPath = currentDirPath;
        } else {
          break;
        }
      } else {
        currentDirPath = currentDirPath.split('/').slice(0, -1).join('/');
      }
    } while (!rootPath);

    cwd = rootPath;
  }

  return cwd;
}

function resolvePathFromRootRelative(relativePath) {
  return resolvePath(resolveRootPath(), relativePath);
}

function getConfig(key, rootPath) {
  const configFilePath = getConfigFilePath(rootPath || resolveRootPath());

  let config = {};

  try {
    config = JSON.parse(readData(configFilePath, true));
  } catch(err) {
    console.log('[ERROR] reading KnoSys config file error: ', err);
  }

  return key ? retrieveData(config, key) : config;
}

function updateConfig(config, rootPath) {
  const resolvedRoot = rootPath || resolveRootPath()

  saveData(getConfigFilePath(resolvedRoot), JSON.stringify(mixin(true, {}, getConfig(null, resolvedRoot), config), null, 2));
}

module.exports = { getGlobalConfigDirPath, getConfigFilePath, resolveRootPath, resolvePathFromRootRelative, getConfig, updateConfig };
