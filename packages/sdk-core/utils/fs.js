const { existsSync, statSync, readdirSync, readFileSync, writeFileSync } = require('fs');
const { safeLoad, safeDump } = require('js-yaml');
const { isPlainObject, omit, mixin } = require('@ntks/toolbox');

const { LEGACY_ENTITY_NAME, ENTITY_MONO_NAME, ENTITY_MAIN_NAME, ENTITY_CONTENT_NAME, META_DIR_NAME } = require('../constants');
const { rm, cp, mkdir, touch } = require('../wrappers/fs');
const { sortByName } = require('./util');
const { normalizeFrontMatter, replaceRefDefsWith } = require('./md');

function ensureDirOrFileExists(resolvedPath, type, removeWhenExists) {
  let targetExists = false;

  if (existsSync(resolvedPath)) {
    if (removeWhenExists === true) {
      rm(resolvedPath);
    } else {
      targetExists = true;
    }
  }

  if (!targetExists) {
    if (type === 'dir') {
      mkdir(resolvedPath);
    } else {
      touch(resolvedPath);
    }
  }
}

/**
 * 确保目录存在
 *
 * @param {*} dirPath 目录绝对路径
 * @param {*} removeWhenExists 是否删除已存在目录
 */
function ensureDirExists(dirPath, removeWhenExists) {
  ensureDirOrFileExists(dirPath, 'dir', removeWhenExists);
}

/**
 * 确保文件存在
 *
 * @param {*} filePath 文件绝对路径
 * @param {*} removeWhenExists 是否删除已存在文件
 */
function ensureFileExists(filePath, removeWhenExists) {
  ensureDirOrFileExists(filePath, 'file', removeWhenExists);
}

function isDirectory(baseName) {
  return statSync(baseName).isDirectory()
}

function scanAndSortByAsc(filePath) {
  return sortByName(readdirSync(filePath));
}

function getImageFileNames(dirPath) {
  return isDirectory(dirPath) ? readdirSync(dirPath).filter(fileBaseName => /(jp(e)?g|png|gif|svg)\b/ig.test(fileBaseName)) : [];
}

function readDirDeeply(dirPath, paramArr, params, callback) {
  const paramKey = paramArr[0];
  const restParamArr = paramArr.slice(1);

  scanAndSortByAsc(dirPath).forEach(baseName => {
    const distPath = `${dirPath}/${baseName}`;

    if (!isDirectory(distPath) || baseName.indexOf('.') === 0) {
      return;
    }

    const newParams = { ...params, [paramKey]: baseName };

    if (restParamArr.length > 0) {
      readDirDeeply(distPath, restParamArr, newParams, callback);
    } else {
      callback(baseName, newParams);
    }
  });
}

function copyFileDeeply(dirPath, distPath, skipNames = []) {
  scanAndSortByAsc(dirPath).forEach(baseName => {
    if (baseName.indexOf('.') === 0 || skipNames.includes(baseName)) {
      return;
    }

    const currentPath = `${dirPath}/${baseName}`;
    const distFullPath = `${distPath}/${baseName}`;

    if (isDirectory(currentPath)) {
      ensureDirExists(distFullPath);
      copyFileDeeply(currentPath, distFullPath, skipNames);
    } else {
      if (existsSync(distFullPath)) {
        rm(distFullPath);
      }

      cp(currentPath, distFullPath);
    }
  });
}

function readFileContent(filePath) {
  return readFileSync(filePath, 'utf8');
}

function readFileContentString(filePath) {
  return readFileContent(filePath).toString().trim();
}

function isMarkdownFile(distPath) {
  return /.+\.md$/i.test(distPath);
}

function isJsonFile(distPath) {
  return /.+\.json$/i.test(distPath);
}

function isYamlFile(distPath) {
  return /.+\.yml$/i.test(distPath);
}

function isLocalRelative(targetPath) {
  return /^(\.\.\/)+[a-z0-9\.\_\-]+/i.test(targetPath);
}

function readData(distPath, raw) {
  if (!existsSync(distPath)) {
    return;
  }

  const rawContent = readFileContentString(distPath);

  if (raw === true) {
    return rawContent;
  }

  if (isJsonFile(distPath)) {
    return JSON.parse(rawContent);
  }

  if (isYamlFile(distPath)) {
    return safeLoad(readFileContent(distPath));
  }

  return rawContent;
}

function saveData(distPath, data, ...others) {
  ensureFileExists(distPath);

  if (typeof data === 'string') {
    let resolved;

    if (isMarkdownFile(distPath) && isPlainObject(others[0])) {
      const frontMatterData = omit(others[0], ['content']);
      const content = data || others[0].content || '';

      if (Object.keys(frontMatterData).length > 0) {
        resolved = `---\n${safeDump(frontMatterData).trim()}\n---\n\n${content}`;
      } else {
        resolved = content;
      }
    } else {
      resolved = data;
    }

    return writeFileSync(distPath, resolved);
  }

  if (isJsonFile(distPath)) {
    return writeFileSync(distPath, JSON.stringify(data));
  }

  if (isYamlFile(distPath)) {
    return writeFileSync(distPath, safeDump(data));
  }
}

function updateData(distPath, data, override = false) {
  if (override === true) {
    return saveData(distPath, data);
  }

  let oldData = readData(distPath);

  if (typeof oldData === 'string') {
    try {
      oldData = JSON.parse(oldData);
    } catch(err) {}
  }

  return saveData(distPath, isPlainObject(oldData) && isPlainObject(data) ? mixin(true, {}, oldData, data) : data);
}

function readReadMe(dirPath) {
  return readData(`${dirPath}/${ENTITY_CONTENT_NAME}`) || '';
}

/**
 * @see https://qiidb.github.io/meta/zh/guides/spec/
 * @deprecated use `readMeta` and `readEntity` instead, will be removed in next major release
 */
function readMetadata(dirPath) {
  const inMetaDir = dirPath.split('/').slice(-1)[0] === META_DIR_NAME;
  const dataFromMain = readData(`${dirPath}/${ENTITY_MAIN_NAME}`);

  let extensible = false;
  let metadata;

  if (inMetaDir) {
    metadata = dataFromMain;
  } else {
    metadata = readData(`${dirPath}/${ENTITY_MONO_NAME}`) || readData(`${dirPath}/${LEGACY_ENTITY_NAME}`);

    if (!metadata) {
      metadata = dataFromMain;
      extensible = true;
    }
  }

  const contentData = readReadMe(dirPath);

  if (contentData) {
    const normalized = normalizeFrontMatter(contentData);

    metadata = { ...(metadata || {}), ...(normalized.data || {}), content: normalized.content };
  }

  if (!metadata) {
    return;
  }

  if (extensible) {
    scanAndSortByAsc(dirPath)
      .filter(baseName => {
        if (baseName.indexOf('.') === 0) {
          return false;
        }

        return isDirectory(`${dirPath}/${baseName}`)
          ? true
          : ['yml', 'md'].includes(baseName.split('.').slice(-1)[0]) && ![LEGACY_ENTITY_NAME, ENTITY_MAIN_NAME, ENTITY_CONTENT_NAME].includes(baseName);
      })
      .forEach(baseName => {
        let extendDataFullPath = `${dirPath}/${baseName}`;

        if (isDirectory(extendDataFullPath)) {
          for (let fileName of [ENTITY_CONTENT_NAME, LEGACY_ENTITY_NAME]) {
            if (existsSync(`${extendDataFullPath}/${fileName}`)) {
              const extendData = readData(`${extendDataFullPath}/${fileName}`);

              metadata[baseName] = typeof extendData === 'string'
                ? replaceRefDefsWith(extendData, (matched, _, ref) => {
                  if (isLocalRelative(ref)) {
                    return matched.replace(ref, ref.split('../').slice(1).join('../'));
                  } else {
                    return matched
                  }
                })
                : extendData;

              break;
            }
          }
        } else {
          metadata[baseName.split('.').slice(0, -1).join('.')] = readData(extendDataFullPath);
        }
      });
  }

  return metadata;
}

function readLocalizedData(dataFilePath) {
  let defaultData = readData(`${dataFilePath}/${LEGACY_ENTITY_NAME}`);
  let i18nData;

  if (!defaultData) {
    defaultData = readData(`${dataFilePath}/default.yml`);
    i18nData = readData(`${dataFilePath}/zh-CN.yml`) || readData(`${dataFilePath}/zh-cn.yml`);
  }

  if (!defaultData) {
    return i18nData;
  }

  if (!i18nData) {
    return defaultData;
  }

  if (Array.isArray(defaultData)) {
    const newData = defaultData.map((item, idx) => i18nData[idx] ? { ...item, ...i18nData[idx] } : item);

    if (i18nData.length > defaultData.length) {
      newData.push(...i18nData.slice(defaultData.length));
    }

    return newData;
  }

  return { ...defaultData, ...i18nData };
}

/**
 * @see https://qiidb.github.io/meta/zh/guides/spec/
 */
function readMeta(dirPath) {
  return readMetadata(`${dirPath}/${META_DIR_NAME}`);
}

/**
 * @see https://qiidb.github.io/meta/zh/guides/spec/
 */
function readEntity(dirPath) {
  return readMetadata(dirPath);
}

module.exports = {
  ensureDirExists, ensureFileExists,
  isDirectory, isLocalRelative,
  scanAndSortByAsc, getImageFileNames, readDirDeeply, copyFileDeeply,
  readData, saveData, updateData, readReadMe, readMetadata, readLocalizedData, readMeta, readEntity,
};
