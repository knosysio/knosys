const { resolve: resolvePath } = require('path');
const { existsSync } = require('fs');

const { rm, cp } = require('./cmd');
const { scanAndSortByAsc, isDirectory, ensureDirExists } = require('./fs');

function readDirDeeply(dirPath, srcPath, distPath) {
  scanAndSortByAsc(dirPath).forEach(baseName => {
    if (baseName.indexOf('.') === 0 || ['_config.yml', '_data'].indexOf(baseName) > -1) {
      return;
    }

    const currentPath = `${dirPath}/${baseName}`;
    const distFullPath = `${distPath}${currentPath.replace(srcPath, '')}`;

    if (isDirectory(currentPath)) {
      ensureDirExists(distFullPath);
      readDirDeeply(currentPath, srcPath, distPath);
    } else {
      if (existsSync(distFullPath)) {
        rm(distFullPath);
      }

      cp(currentPath, distFullPath);
    }
  });
}

function copyTheme(nameOrSrcPath, distPath) {
  const themeDirPath = nameOrSrcPath.split('/').length > 1 ? nameOrSrcPath : resolvePath(__dirname, '../../tmpl/lime');

  readDirDeeply(themeDirPath, themeDirPath, distPath);
}

module.exports = { copyTheme };
