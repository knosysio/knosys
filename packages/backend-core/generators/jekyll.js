const { resolve: resolvePath } = require('path');
const { existsSync } = require('fs');
const { execSync } = require('child_process');

const { DEFAULT_PATH_SCHEMA } = require('../constants');
const { rm, cp } = require('../wrappers/fs');
const { scanAndSortByAsc, isDirectory, ensureDirExists, readDirDeeply, readMetadata, saveData, resolvePathFromParams, resolveRootPath } = require('../utils');

function generateJekyllData(srcPath, dataSourcePath) {
  const generatedDataDirPath = `${srcPath}/_data`;

  ensureDirExists(generatedDataDirPath);

  const paramArr = DEFAULT_PATH_SCHEMA.split('/').map(part => part.slice(1));
  const siteDataMap = {};

  readDirDeeply(dataSourcePath, paramArr, {}, (_, params) => {
    const entity = readMetadata(`${dataSourcePath}/${resolvePathFromParams(paramArr.join('/'), params)}`);

    if (!entity) {
      return;
    }

    if (!siteDataMap[params.collection]) {
      siteDataMap[params.collection] = { items: {}, sequence: [] };
    }

    const generatedCollectionDirPath = `${srcPath}/_${params.collection}`;

    ensureDirExists(generatedCollectionDirPath, siteDataMap[params.collection].sequence.length === 0);
    saveData(`${generatedCollectionDirPath}/${params.slug}.md`, entity.content, entity);

    siteDataMap[params.collection].items[params.slug] = entity;
    siteDataMap[params.collection].sequence.push(params.slug);
  });

  Object.entries(siteDataMap).forEach(([collection, data]) => {
    saveData(`${generatedDataDirPath}/${collection}.yml`, data);
  });
}

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

// function readDirDeeply(dirPath, srcPath, distPath) {
//   scanAndSortByAsc(dirPath).forEach(baseName => {
//     if (baseName.indexOf('.') === 0 || ['_config.yml', '_data'].indexOf(baseName) > -1) {
//       return;
//     }

//     const currentPath = `${dirPath}/${baseName}`;
//     const distFullPath = `${distPath}${currentPath.replace(srcPath, '')}`;

//     if (isDirectory(currentPath)) {
//       ensureDirExists(distFullPath);
//       readDirDeeply(currentPath, srcPath, distPath);
//     } else {
//       if (existsSync(distFullPath)) {
//         rm(distFullPath);
//       }

//       cp(currentPath, distFullPath);
//     }
//   });
// }

// function copyTheme(nameOrSrcPath, distPath) {
//   const themeDirPath = nameOrSrcPath.split('/').length > 1 ? nameOrSrcPath : resolvePath(__dirname, '../../tmpl/lime');

//   readDirDeeply(themeDirPath, themeDirPath, distPath);
// }

module.exports = { generateJekyllData, serveJekyllSite, generateJekyllSite/*, copyTheme*/ };
