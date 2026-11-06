import { readFileSync } from 'fs';
import { isPlainObject, isString, capitalize, pick } from '../compat/utils';

import {
  META_DIR_NAME, DEFAULT_PATH_SCHEMA,
  generateIdFromDate,
  resolvePathFromRootRelative, resolvePathFromParams,
  getGlobalConfigDirPath, getConfig,
  getImageFileNames, readDirDeeply, readEntity, readMeta, readData, saveData, ensureDirExists,
} from '../core';

/**
 * Get global app root directory path
 */
export function getGlobalAppRootDirPath(): string {
  return `${getGlobalConfigDirPath()}/apps`;
}

/**
 * Get global app directory path
 */
export function getGlobalAppDirPath(appName: string): string {
  return `${getGlobalAppRootDirPath()}/${appName}`;
}

/**
 * Get app config
 */
export function getAppConfig(rootPath?: string): any {
  return getConfig('app', rootPath);
}

/**
 * Resolve meta data
 */
export function resolveMeta(dirPath: string): any {
  const meta = readMeta(dirPath);
  const appMeta = readData(`${dirPath}/${META_DIR_NAME}/app.yml`);

  if (!meta && !appMeta) {
    return undefined;
  }

  if (meta) {
    return appMeta ? { ...meta, app: { ...(meta.app || {}), ...appMeta } } : meta;
  }

  return { app: appMeta };
}

/**
 * Resolve app meta data
 */
export function resolveAppMeta(params: any, categorized: boolean, dataSourcePath: string): any | false {
  const meta: any = {};

  let collectionMeta: any;

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

/**
 * Resolve route
 */
export function resolveRoute(params: any, meta: any, routeMap: any, categorized: boolean): void {
  const cateName = categorized ? params.category : 'kb';

  if (!routeMap[cateName]) {
    routeMap[cateName] = { name: cateName, path: cateName, children: [] };

    if (categorized) {
      const cateMeta = meta.category;

      if (cateMeta && cateMeta.title) {
        routeMap[cateName].meta = { text: cateMeta.title };
      }
    }
  }

  const route: { name: string; path: string; meta?: { text: string } } = { name: `${cateName}${capitalize(params.collection)}`, path: `${cateName}/${params.collection}` };
  const collectionMeta = meta.collection;

  if (collectionMeta && collectionMeta.title) {
    route.meta = { text: collectionMeta.title };
  }

  routeMap[cateName].children.push(route);
}

/**
 * Order routes alphabetically
 */
export function orderRoutesAlphabetically(routeMap: any): any[] {
  return Object.values(routeMap).sort((a: any, b: any) => a.name > b.name ? 1 : -1);
}

/**
 * Order routes
 */
export function orderRoutes(routeMap: any, specificOrder: string[], categorized: boolean, dataSourcePath: string, level: number = 1): any[] {
  if (categorized && level === 1) {
    Object.entries(routeMap).forEach(([k, v]: [string, any]) => {
      if (v.children.length === 0) {
        return;
      }

      const meta = resolveMeta(`${dataSourcePath}/${k}`);
      const childMap = v.children.reduce((p: any, c: any) => ({ ...p, [c.name]: c }), {});
      const childrenOrder = ((meta?.app || {}).order || meta?.order || []).map((c: string) => `${k}${capitalize(c)}`);

      routeMap[k].children = orderRoutes(childMap, childrenOrder, false, dataSourcePath);
    });
  }

  if (specificOrder.length === 0) {
    return orderRoutesAlphabetically(routeMap);
  }

  const ordered: any[] = [];

  specificOrder.forEach(cateName => {
    const route = routeMap[cateName];

    if (route) {
      ordered.push(route);

      delete routeMap[cateName];
    }
  });

  return [...ordered, ...orderRoutesAlphabetically(routeMap)];
}

/**
 * Resolve param path parts
 */
export function resolveParamPathParts(pathSchema: string): string[] {
  return pathSchema.split('/').map(part => part.slice(1));
}

/**
 * Generate ID
 */
export function generateId(date?: Date): string {
  const randomStr = Array.from(new Array(8)).map(() => (Math.ceil(Math.random() * 36) - 1).toString(36)).join('');

  return `${generateIdFromDate(date)}-${randomStr}`;
}

/**
 * Resolve records
 */
export function resolveRecords(collectionPath: string, paramArr: string[], parentParams: any): any[] {
  const records: any[] = [];

  readDirDeeply(collectionPath, paramArr, parentParams, (_, params: any) => {
    const recordPath = resolvePathFromParams(paramArr.join('/'), params);
    const distPath = `${collectionPath}/${recordPath}`;
    const { content, ...others } = readEntity(distPath) || {};
    const imageMap: any = {};

    getImageFileNames(distPath).forEach(fileName => {
      const baseName = fileName.split('.').slice(0, -1).join('.');

      if (['cover', 'banner'].includes(baseName)) {
        imageMap[baseName] = readFileSync(`${distPath}/${fileName}`).toString('base64');
      }
    });

    records.push({
      id: generateId(others.date),
      path: recordPath,
      ...pick(others, ['title', 'description', 'date', 'tags']),
      ...imageMap,
    });
  });

  return records;
}

/**
 * Resolve app info
 */
export function resolveAppInfo(config: any): any | false {
  const dataSourcePath = resolvePathFromRootRelative(config.data || './data');
  if (!dataSourcePath) return false;

  const { path = DEFAULT_PATH_SCHEMA, app: appSpecific = {}, ...others } = resolveMeta(dataSourcePath) || {};

  if (appSpecific === false) {
    return false;
  }

  const paramArr = resolveParamPathParts(path);

  if (!['category', 'collection'].includes(paramArr[0])) {
    return false;
  }

  const app: Record<string, unknown> = { name: config.name, title: config.title || 'KnoSys', source: dataSourcePath };

  const categorized = paramArr[0] === 'category';
  const recordParamPathArr = paramArr.splice(categorized ? 2 : 1);

  const routeMap: any = {};
  const collectionMap: any = {};

  readDirDeeply(dataSourcePath, paramArr, {}, (_, params: any) => {
    const meta = resolveAppMeta(params, categorized, dataSourcePath);

    if (meta === false) {
      return;
    }

    let mapKey: string;
    let collectionPath: string;

    if (categorized) {
      mapKey = `${params.category}${capitalize(params.collection)}`;
      collectionPath = `${params.category}/${params.collection}`;
    } else {
      mapKey = collectionPath = params.collection;
    }

    resolveRoute(params, meta, routeMap, categorized);

    const resolvedRecordParamPathArr = meta.collection && meta.collection.path ? resolveParamPathParts(meta.collection.path) : recordParamPathArr;

    collectionMap[mapKey] = {
      id: generateId(),
      title: meta.collection && meta.collection.title,
      path: collectionPath,
      records: resolveRecords(`${dataSourcePath}/${collectionPath}`, resolvedRecordParamPathArr, params),
    };
  });

  app.routes = orderRoutes(routeMap, appSpecific.order || others.order || [], categorized, dataSourcePath);

  return { app, db: collectionMap };
}

/**
 * Init app
 */
export function initApp(): Promise<any> {
  const config = getAppConfig();

  if (!isPlainObject(config) || !config.name || !isString(config.name)) {
    return Promise.resolve();
  }

  const resolved = resolveAppInfo(config);

  if (resolved === false) {
    return Promise.resolve();
  }

  const distAppDirPath = getGlobalAppDirPath(config.name);

  ensureDirExists(distAppDirPath);
  ['app', 'db'].forEach(k => resolved[k] && saveData(`${distAppDirPath}/${k}.json`, JSON.stringify(resolved[k], null, 2)));

  return Promise.resolve(config);
}
