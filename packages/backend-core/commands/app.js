const { resolve: resolvePath } = require('path');
const { execSync } = require('child_process');

const { isPlainObject, isString, isFunction, capitalize } = require('@ntks/toolbox');

const { META_DIR_NAME, DEFAULT_PATH_SCHEMA, DEFAULT_APP_TITLE } = require('../constants');
const { resolvePathFromRootRelative, getConfig, readDirDeeply, readData, readMeta, getGlobalConfigDirPath, ensureDirExists, saveData } = require('../utils')

const appTempPath = `${getGlobalConfigDirPath()}/apps`;

function resolveMeta(dirPath) {
  const meta = readMeta(dirPath);
  const appMeta = readData(`${dirPath}/${META_DIR_NAME}/app.yml`);

  if (!meta && !appMeta) {
    return;
  }

  if (meta) {
    return appMeta ? { ...meta, app: { ...(meta.app || {}), ...appMeta } } : meta;
  }

  return { app: appMeta }
}

function resolveAppMeta(params, categorized, dataSourcePath) {
  const meta = {};

  let collectionMeta

  if (categorized) {
    const cateDirPath = `${dataSourcePath}/${params.category}`;
    const cateMeta = resolveMeta(cateDirPath);

    if (cateMeta) {
      if (cateMeta.app === false) {
        return false;
      }

      meta.category = cateMeta;
    }

    collectionMeta = resolveMeta(`${cateDirPath}/${params.collection}`);
  } else {
    collectionMeta = resolveMeta(`${dataSourcePath}/${params.collection}`);
  }

  if (collectionMeta) {
    if (collectionMeta.app === false) {
      return false;
    }

    meta.collection = collectionMeta;
  }

  return meta;
}

function resolveRoute(params, meta, routeMap, categorized) {
  const cateName = categorized ? params.category : 'kb';

  if (!routeMap[cateName]) {
    routeMap[cateName] = { name: cateName, path: cateName, children: [] }

    if (categorized) {
      const cateMeta = meta.category;

      if (cateMeta && cateMeta.title) {
        routeMap[cateName].meta = { text: cateMeta.title };
      }
    }
  }

  const route = { name: `${cateName}${capitalize(params.collection)}`, path: `${cateName}/${params.collection}` };
  const collectionMeta = meta.collection;

  if (collectionMeta && collectionMeta.title) {
    route.meta = { text: collectionMeta.title };
  }

  routeMap[cateName].children.push(route);
}


function orderRoutesAlphabetically(routeMap) {
  return Object.values(routeMap).sort((a, b) => a.name > b.name ? 1 : -1);
}

function orderRoutes(routeMap, specificOrder, categorized, dataSourcePath, level = 1) {
  if (categorized && level === 1) {
    Object.entries(routeMap).forEach(([k, v]) => {
      if (v.children.length === 0) {
        return;
      }

      const meta = resolveMeta(`${dataSourcePath}/${k}`);
      const childMap = v.children.reduce((p, c) => ({ ...p, [c.name]: c }), {});
      const childrenOrder = ((meta.app || {}).order || meta.order || []).map(c => `${k}${capitalize(c)}`);

      routeMap[k].children = orderRoutes(childMap, childrenOrder, false);
    });
  }

  if (specificOrder.length === 0) {
    return orderRoutesAlphabetically(routeMap);
  }

  const ordered = [];

  specificOrder.forEach(cateName => {
    const route = routeMap[cateName];

    if (route) {
      ordered.push(route);

      delete routeMap[cateName];
    }
  });

  return [].concat(ordered, orderRoutesAlphabetically(routeMap));
}

function resolveAppInfo(config) {
  const dataSourcePath = resolvePathFromRootRelative(config.data || './data');
  const { path = DEFAULT_PATH_SCHEMA, app: appSpecific = {}, ...others } = resolveMeta(dataSourcePath) || {};

  if (appSpecific === false) {
    return false;
  }

  const paramArr = path.split('/').map(part => part.slice(1));

  if (!['category', 'collection'].includes(paramArr[0])) {
    return false;
  }

  const app = { name: config.name, title: config.title || DEFAULT_APP_TITLE };

  const categorized = paramArr[0] === 'category';
  const routeMap = {};
  const collectionMap = {}

  readDirDeeply(dataSourcePath, paramArr, {}, (_, params) => {
    const meta = resolveAppMeta(params, categorized, dataSourcePath);

    if (meta === false) {
      return;
    }

    const mapKey = categorized ? `${params.category}${capitalize(params.collection)}` : params.collection;

    if (!collectionMap[mapKey]) {
      resolveRoute(params, meta, routeMap, categorized);

      collectionMap[mapKey] = true;
    }
  });

  app.routes = orderRoutes(routeMap, appSpecific.order || others.order || [], categorized, dataSourcePath);

  return { app };
}

function initApp(config, callback) {
  if (!isPlainObject(config) || !config.name || !isString(config.name)) {
    return;
  }

  const resolved = resolveAppInfo(config);

  if (resolved === false) {
    return;
  }

  const distAppDirPath = `${appTempPath}/${config.name}`;

  ensureDirExists(distAppDirPath);
  ['app', 'db'].forEach(k => resolved[k] && saveData(`${distAppDirPath}/${k}.json`, JSON.stringify(resolved[k], null, 2)));

  if (isFunction(callback)) {
    callback(config);
  }
}

function serveApp({ name }) {
  const encodedPath = encodeURIComponent(`${appTempPath}/${name}`);

  execSync(`KNOSYS_APP_PATH=${encodedPath} npm run dev`, { stdio: 'inherit', cwd: resolvePath(__dirname, '../../client-web') });
}

module.exports = {
  execute: (subCmd = 'serve') => {
    if (subCmd !== 'serve') {
      return;
    }

    initApp(getConfig('app'), config => serveApp(config));
  },
};
