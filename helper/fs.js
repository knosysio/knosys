const { existsSync, statSync, readdirSync, readFileSync, writeFileSync } = require('fs');
const { safeLoad, safeDump } = require('js-yaml');

const { sortByName } = require('./util');
const { rm, mkdir, touch } = require('./cmd');
const { replaceRefDefsWith } = require('./md');

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

function readFileContent(filePath) {
  return readFileSync(filePath, 'utf8');
}

function readFileContentString(filePath) {
  return readFileContent(filePath).toString().trim();
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

function readData(distPath) {
  if (!existsSync(distPath)) {
    return;
  }

  if (isJsonFile(distPath)) {
    return JSON.parse(readFileContentString(distPath));
  }

  if (isYamlFile(distPath)) {
    return safeLoad(readFileContent(distPath));
  }

  return readFileContentString(distPath);
}

function saveData(distPath, data) {
  ensureFileExists(distPath);

  if (typeof data === 'string') {
    return writeFileSync(distPath, data);
  }

  if (isJsonFile(distPath)) {
    return writeFileSync(distPath, JSON.stringify(data));
  }

  if (isYamlFile(distPath)) {
    return writeFileSync(distPath, safeDump(data));
  }
}

function readMetadata(dirPath) {
  const metadata = readData(`${dirPath}/metadata.yml`) || readData(`${dirPath}/basic.yml`);

  if (!metadata) {
    return;
  }

  scanAndSortByAsc(dirPath)
    .filter(baseName => {
      if (baseName.indexOf('.') === 0) {
        return false;
      }

      return isDirectory(`${dirPath}/${baseName}`)
        ? true
        : ['yml', 'md'].includes(baseName.split('.').slice(-1)[0]) && !['metadata.yml', 'basic.yml', 'readme.md'].includes(baseName);
    })
    .forEach(baseName => {
      let extendDataFullPath = `${dirPath}/${baseName}`;

      if (isDirectory(extendDataFullPath)) {
        for (let fileName of ['readme.md', 'metadata.yml']) {
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

  return metadata;
}

module.exports = {
  ensureDirExists, ensureFileExists,
  isDirectory, isLocalRelative,
  scanAndSortByAsc, getImageFileNames, readDirDeeply,
  readData, saveData, readMetadata,
};
