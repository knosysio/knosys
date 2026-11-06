import { existsSync, statSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { safeLoad, safeDump } from 'js-yaml';
import { isPlainObject, omit, mixin } from '../../compat/utils';

import { LEGACY_ENTITY_NAME, ENTITY_MONO_NAME, ENTITY_MAIN_NAME, ENTITY_CONTENT_NAME, META_DIR_NAME } from '../constants';
import { rm, cp, mkdir, touch } from '../wrappers/fs';
import { sortByName } from './util';
import { normalizeFrontMatter, replaceRefDefsWith } from './md';

/**
 * Ensure directory or file exists
 */
function ensureDirOrFileExists(resolvedPath: string, type: 'dir' | 'file', removeWhenExists: boolean): void {
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
 * Ensure directory exists
 *
 * @param dirPath Directory absolute path
 * @param removeWhenExists Whether to remove existing directory
 */
export function ensureDirExists(dirPath: string, removeWhenExists: boolean = false): void {
  ensureDirOrFileExists(dirPath, 'dir', removeWhenExists);
}

/**
 * Ensure file exists
 *
 * @param filePath File absolute path
 * @param removeWhenExists Whether to remove existing file
 */
export function ensureFileExists(filePath: string, removeWhenExists: boolean = false): void {
  ensureDirOrFileExists(filePath, 'file', removeWhenExists);
}

/**
 * Check if path is directory
 */
export function isDirectory(baseName: string): boolean {
  return statSync(baseName).isDirectory();
}

/**
 * Scan directory and sort files by name in ascending order
 */
export function scanAndSortByAsc(filePath: string): string[] {
  return sortByName(readdirSync(filePath));
}

/**
 * Get image file names from directory
 */
export function getImageFileNames(dirPath: string): string[] {
  return isDirectory(dirPath) ? readdirSync(dirPath).filter(fileBaseName => /(jp(e)?g|png|gif|svg)\b/ig.test(fileBaseName)) : [];
}

/**
 * Read directory deeply
 */
export function readDirDeeply(dirPath: string, paramArr: string[], params: Record<string, string>, callback: (baseName: string, newParams: Record<string, string>) => void): void {
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

/**
 * Copy file deeply
 */
export function copyFileDeeply(dirPath: string, distPath: string, skipNames: string[] = [], dotFilesIncluded: boolean = false): void {
  scanAndSortByAsc(dirPath).forEach(baseName => {
    if (!dotFilesIncluded && baseName.indexOf('.') === 0 || skipNames.includes(baseName)) {
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

/**
 * Read file content
 */
export function readFileContent(filePath: string): Buffer {
  return readFileSync(filePath);
}

/**
 * Read file content as string
 */
export function readFileContentString(filePath: string): string {
  return readFileContent(filePath).toString().trim();
}

/**
 * Check if file is markdown file
 */
export function isMarkdownFile(distPath: string): boolean {
  return /.+\.md$/i.test(distPath);
}

/**
 * Check if file is json file
 */
export function isJsonFile(distPath: string): boolean {
  return /.+\.json$/i.test(distPath);
}

/**
 * Check if file is yaml file
 */
export function isYamlFile(distPath: string): boolean {
  return /.+\.yml$/i.test(distPath);
}

/**
 * Check if path is local relative path
 */
export function isLocalRelative(targetPath: string): boolean {
  return /^(\.\.\/)+[a-z0-9\.\_\-]+/i.test(targetPath);
}

/**
 * Read data from file
 */
export function readData(distPath: string, raw: boolean = false): any {
  if (!existsSync(distPath)) {
    return undefined;
  }

  const rawContent = readFileContentString(distPath);

  if (raw === true) {
    return rawContent;
  }

  if (isJsonFile(distPath)) {
    return JSON.parse(rawContent);
  }

  if (isYamlFile(distPath)) {
    return safeLoad(readFileContent(distPath).toString());
  }

  return rawContent;
}

/**
 * Save data to file
 */
export function saveData(distPath: string, data: any, ...others: any[]): void {
  ensureFileExists(distPath);

  if (typeof data === 'string') {
    let resolved: string;

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

/**
 * Update data in file
 */
export function updateData(distPath: string, data: any, override: boolean = false): void {
  if (override === true) {
    return saveData(distPath, data);
  }

  let oldData = readData(distPath);

  if (typeof oldData === 'string') {
    try {
      oldData = JSON.parse(oldData);
    } catch (err) {}
  }

  return saveData(distPath, isPlainObject(oldData) && isPlainObject(data) ? mixin(true, {}, oldData, data) : data);
}

/**
 * Read README file
 */
export function readReadMe(dirPath: string): string {
  return readData(`${dirPath}/${ENTITY_CONTENT_NAME}`) || '';
}

/**
 * @see https://qiidb.github.io/meta/zh/guides/spec/
 * @deprecated use `readMeta` and `readEntity` instead, will be removed in next major release
 */
export function readMetadata(dirPath: string): any {
  const inMetaDir = dirPath.split('/').slice(-1)[0] === META_DIR_NAME;
  const dataFromMain = readData(`${dirPath}/${ENTITY_MAIN_NAME}`);

  let extensible = false;
  let metadata: any;

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
    return undefined;
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
          for (const fileName of [ENTITY_CONTENT_NAME, LEGACY_ENTITY_NAME]) {
            if (existsSync(`${extendDataFullPath}/${fileName}`)) {
              const extendData = readData(`${extendDataFullPath}/${fileName}`);

              metadata[baseName] = typeof extendData === 'string'
                ? replaceRefDefsWith(extendData, (matched, _, ref) => {
                  if (isLocalRelative(ref)) {
                    return matched.replace(ref, ref.split('../').slice(1).join('../'));
                  } else {
                    return matched;
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

/**
 * Read localized data
 */
export function readLocalizedData(dataFilePath: string): any {
  let defaultData = readData(`${dataFilePath}/${LEGACY_ENTITY_NAME}`);
  let i18nData: any;

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
export function readMeta(dirPath: string): any {
  return readMetadata(`${dirPath}/${META_DIR_NAME}`);
}

/**
 * @see https://qiidb.github.io/meta/zh/guides/spec/
 */
export function readEntity(dirPath: string): any {
  return readMetadata(dirPath);
}
