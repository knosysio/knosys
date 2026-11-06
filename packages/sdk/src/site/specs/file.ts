import { resolve as resolvePath, normalize as normalizePath, sep } from 'path';
import { isFunction } from '../../compat/utils';

import {
  normalizeFrontMatter,
  isDirectory, scanAndSortByAsc, ensureDirExists,
  readMeta, readData, saveData, readEntity,
  cp,
} from '../../core';

import { resolvePermalink } from './helper';

/**
 * Read directory deeply
 */
function readDirDeeply(dirPath: string, paths: string[], callback: (baseName: string, paths: string[]) => void): void {
  scanAndSortByAsc(dirPath).forEach(baseName => {
    const distPath = `${dirPath}/${baseName}`;
    const deepReadable = isDirectory(distPath);

    if (baseName.indexOf('.') === 0 || (!deepReadable && !distPath.endsWith('.md'))) {
      return;
    }

    const newPaths = [...paths, baseName];

    if (deepReadable) {
      readDirDeeply(distPath, newPaths.slice(), callback);
    } else {
      callback(baseName, newPaths.slice());
    }
  });
}

/**
 * Resolve page slug
 */
function resolvePageSlug(baseName: string, paths: string[]): string {
  const dirPath = paths.join('/');

  if (baseName === 'index.md') {
    return dirPath;
  }

  const purePath = baseName.replace('.md', '');

  return dirPath === '' ? purePath : `${dirPath}/${purePath}`;
}

/**
 * Copy referenced image file
 */
function copyRefImageFile(imgSrc: string, dataSrc: string, srcDir: string, distDir: string): void {
  if (imgSrc.indexOf('http') === 0 || imgSrc.indexOf('/') === 0) {
    return;
  }

  const resolvedImgSrc = resolvePath(srcDir, imgSrc);
  const resolvedImgPartial = resolvedImgSrc.replace(normalizePath(`${dataSrc}/`), '');
  const dirNames = resolvedImgPartial.split(sep).slice(0, -1);

  if (dirNames.length > 0) {
    ensureDirExists(`${distDir}/${dirNames.join('/')}`);
  }

  cp(resolvedImgSrc, normalizePath(`${distDir}/${resolvedImgPartial}`));
}

/**
 * Order document tree
 */
function orderDocTree(docs: any[]): any[] {
  const childless: any[] = [];
  const children: any[] = [];

  let indexDoc: any;

  docs.forEach(doc => {
    if (doc.children) {
      children.push({ ...doc, children: orderDocTree(doc.children) });
    } else if (doc.uri.endsWith('index.md')) {
      indexDoc = doc;
    } else {
      childless.push(doc);
    }
  });

  childless.sort((a, b) => a.uri > b.uri ? 1 : -1);
  children.sort((a, b) => a.uri > b.uri ? 1 : -1);

  if (indexDoc) {
    childless.unshift(indexDoc);
  }

  return [...childless, ...children];
}

/**
 * Resolve document data
 */
function resolveDocData(docs: any[], dataSrcPath: string): any {
  const root: any = {};

  docs.forEach(doc => {
    const pathParts = [...doc.dirPaths, doc.baseName];

    let currentNode = root;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts.slice(0, i + 1).join('/');

      let child: any;

      if (currentNode.children) {
        child = currentNode.children.find((child: any) => child.uri === part);
      }

      if (!child) {
        child = {
          title: i === pathParts.length - 1 && doc.title || (readMeta(`${dataSrcPath}/${part}`) || {}).title || part,
          uri: part,
        };

        if (currentNode.children) {
          currentNode.children.push(child);
        } else {
          currentNode.children = [child];
        }
      }

      currentNode = child;
    }
  });

  return { count: docs.length, structure: orderDocTree(root.children) };
}

/**
 * Generate file-based spec data
 */
export function generateFileBasedSpecData(srcPath: string, dataSourcePath: string, options: any = {}): void {
  const { permalink = '/:path/' } = readMeta(dataSourcePath) || {};
  const { sourceKey, dataDir, docDir, imageDir, formatter } = options;

  const generatedDataDirPath = `${srcPath}/${dataDir}/knosys/${sourceKey}`;
  const generatedFileDirPath = `${srcPath}/${docDir}/${sourceKey}`;
  const generatedImageDirPath = `${srcPath}/${imageDir}/knosys/${sourceKey}`;

  ensureDirExists(generatedDataDirPath, true);
  ensureDirExists(generatedFileDirPath, true);
  ensureDirExists(generatedImageDirPath, true);

  const docs: any[] = [];

  readDirDeeply(dataSourcePath, [], (baseName, paths) => {
    const dirPaths = paths.slice(0, -1);
    const distDirPath = dirPaths.length > 0 ? `${generatedFileDirPath}/${dirPaths.join('/')}` : generatedFileDirPath;

    const srcDirPath = `${dataSourcePath}/${dirPaths.join('/')}`;
    const content = readData(`${srcDirPath}/${baseName}`);
    const slug = resolvePageSlug(baseName, dirPaths);

    let frontMatter = readEntity(distDirPath) || {};

    if (content) {
      const normalized = normalizeFrontMatter(content);

      frontMatter = { ...(normalized.data || {}), content: normalized.content };
    }

    if (permalink && !frontMatter.permalink) {
      frontMatter.permalink = resolvePermalink(permalink, { slug });
    }

    if (frontMatter.content) {
      [...Array.from(String(frontMatter.content).matchAll(/!\[([^\[\]]+)?\]\(([^\(\)]+)\)/g)), ...Array.from(String(frontMatter.content).matchAll(/<img([^>]+)src=["']([^"']*)["'][^>]*>/gi))]
        .forEach((matched) => copyRefImageFile(matched[2], dataSourcePath, srcDirPath, generatedImageDirPath));

      if (isFunction(formatter)) {
        frontMatter.content = formatter(frontMatter.content, {
          spec: 'file',
          pathSchema: '',
          slug,
          imageDir: `knosys/${sourceKey}`,
          entitySrc: srcDirPath,
          entityBaseName: baseName,
        });
      }
    }

    docs.push({ title: frontMatter.title || '', dirPaths, baseName });

    ensureDirExists(distDirPath);
    saveData(`${distDirPath}/${baseName}`, frontMatter.content || '', frontMatter);
  });

  saveData(`${generatedDataDirPath}/docs.yml`, resolveDocData(docs, dataSourcePath));
}
