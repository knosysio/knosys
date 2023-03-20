const { resolve: resolvePath } = require('path');
const { existsSync } = require('fs');
const { execSync } = require('child_process');

const { rm, cp } = require('../wrappers/fs');
const { scanAndSortByAsc, isDirectory, ensureDirExists, resolveRootPath } = require('../utils');

function serveJekyllSite(srcPath) {
  const flags = [
    `--source ${srcPath}`,
    `--config ${srcPath}/_config.yml`,
    '--future',
    '--drafts',
    '--incremental',
  ];

  execSync(`bundle exec jekyll serve ${flags.join(' ')}`, { stdio: 'inherit' });
}

function generateJekyllSite(srcPath, distPath) {
  const flags = [
    `--source ${srcPath}`,
    `--destination ${distPath}`,
    `--config ${srcPath}/_config.yml`,
  ];

  execSync([
    `cd ${resolveRootPath()}`,
    'bundle exec jekyll clean',
    `JEKYLL_ENV=production bundle exec jekyll build ${flags.join(' ')}`,
    `cd ${distPath}`,
    'touch .nojekyll'
  ].join(' && '), { stdio: 'inherit' });
}

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

module.exports = { serveJekyllSite, generateJekyllSite, copyTheme };
