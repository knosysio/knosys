const { resolve: resolvePath } = require('path');
const { execSync } = require('child_process');

const { capitalize } = require('@ntks/toolbox');

const { META_DIR_NAME, DEFAULT_PATH_SCHEMA } = require('../constants');
const { resolvePathFromRootRelative, getConfig, readDirDeeply, readData, readMeta, getGlobalConfigDirPath, ensureDirExists, saveData } = require('../utils')

const appTempPath = `${getGlobalConfigDirPath()}/apps`;

function resolveRoutes() {
  const dataSourcePath = resolvePathFromRootRelative('./data');
  const { path = DEFAULT_PATH_SCHEMA, ...others } = readMeta(dataSourcePath) || {};

  const paramArr = path.split('/').map(part => part.slice(1));

  if (!['category', 'collection'].includes(paramArr[0])) {
    return [];
  }

  const categorized = paramArr[0] === 'category';
  const routeMap = {};

  readDirDeeply(dataSourcePath, paramArr.slice(0, categorized ? 2 : 1), {}, (baseName, { category, collection }) => {
    let cateName;
    let pathArr;

    if (categorized) {
      cateName = category;
      pathArr = [category, collection];
    } else {
      cateName = 'pkb';
      pathArr = [collection];
    }

    if (!routeMap[cateName]) {
      routeMap[cateName] = {
        name: cateName,
        path: `/${cateName}`,
        meta: categorized ? (readMeta(`${dataSourcePath}/${category}`) || {}) : {},
        children: [],
      }
    }

    routeMap[cateName].children.push({
      name: `${cateName}${capitalize(collection)}`,
      path: `/${cateName}/${collection}`,
      meta: readMeta(`${dataSourcePath}/${pathArr.join('/')}`) || {},
    })
  });

  const appSpecific = readData(`${dataSourcePath}/${META_DIR_NAME}/app.yml`) || {};
  const categoryOrder = appSpecific.order || others.order || [];

  if (categoryOrder.length === 0) {
    return Object.values(routeMap);
  }

  const ordered = [];

  categoryOrder.forEach(cateName => {
    const route = routeMap[cateName];

    if (route) {
      ordered.push(route);

      delete routeMap[cateName];
    }
  });

  return [].concat(ordered, Object.values(routeMap));
}

function initApp(appName) {
  const distAppDirPath = `${appTempPath}/${appName}`;

  ensureDirExists(distAppDirPath);

  saveData(`${distAppDirPath}/routes.json`, JSON.stringify(resolveRoutes()));
}

function serveApp({ name, title = 'KnoSys' }) {
  const envs = [
    `KNOSYS_APP_NAME=${name}`,
    `KNOSYS_APP_TITLE=${title}`,
  ];

  execSync(`${envs.join(' ')} npm run dev`, { stdio: 'inherit', cwd: resolvePath(__dirname, '../../client-web') });
}

module.exports = {
  execute: (subCmd = 'serve') => {
    if (subCmd !== 'serve') {
      return;
    }

    const appConfig = getConfig('app');

    initApp(appConfig.name);
    serveApp(appConfig);
  },
};
