import { resolve as resolvePath } from 'path';
import { existsSync } from 'fs';
import { retrieveData, mixin } from '../../compat/utils';

import { GLOBAL_DIR_NAME, LOCAL_DIR_NAME, CONFIG_FILE_NAME } from '../constants';
import { readData, saveData } from './fs';

/**
 * Get global config directory path
 */
export function getGlobalConfigDirPath(): string {
  return resolvePath(process.env.HOME || process.env.USERPROFILE || '', GLOBAL_DIR_NAME);
}

/**
 * Get config file path
 */
export function getConfigFilePath(cwd: string): string {
  const configFilePath = `${cwd}/${CONFIG_FILE_NAME}`;

  return existsSync(configFilePath) ? configFilePath : `${cwd}/${LOCAL_DIR_NAME}/config.json`;
}

/**
 * `root` is somewhere the config file located
 *
 * @returns `root`'s absolute path
 */
export function resolveRootPath(projectRoot?: string): string | undefined {
  let cwd = projectRoot || process.env.INIT_CWD || process.cwd();

  let currentDirPath: string = cwd;
  while (!existsSync(getConfigFilePath(currentDirPath))) {
    const parentPath: string = resolvePath(currentDirPath, '..');
    if (parentPath === currentDirPath) return undefined;
    currentDirPath = parentPath;
  }
  cwd = currentDirPath;

  return cwd;
}

/**
 * Resolve path from root relative path
 */
export function resolvePathFromRootRelative(relativePath: string, projectRoot?: string): string | undefined {
  const rootPath = resolveRootPath(projectRoot);
  return rootPath ? resolvePath(rootPath, relativePath) : undefined;
}

/**
 * Get config
 */
export function getConfig(key?: string, rootPath?: string): any {
  const configFilePath = getConfigFilePath(rootPath || resolveRootPath() || '');

  let config: any = {};

  try {
    config = JSON.parse(readData(configFilePath, true) as string);
  } catch (err) {
    console.log('[ERROR] reading KnoSys config file error: ', err);
  }

  return key ? retrieveData(config, key) : config;
}

/**
 * Update config
 */
export function updateConfig(config: any, rootPath?: string): void {
  const resolvedRoot = rootPath || resolveRootPath() || '';

  saveData(getConfigFilePath(resolvedRoot), JSON.stringify(mixin(true, {}, getConfig(undefined, resolvedRoot), config), null, 2));
}
