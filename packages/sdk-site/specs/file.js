const { resolve: resolvePath } = require('path');
const { isFunction } = require('@ntks/toolbox');

const {
  normalizeFrontMatter,
  isDirectory, scanAndSortByAsc, ensureDirExists,
  readMeta, readData, saveData, readEntity,
  cp,
} = require('../../sdk-core');

const { resolvePermalink } = require('./helper');

function readDirDeeply(dirPath, paths, callback) {
  scanAndSortByAsc(dirPath).forEach(baseName => {
    const distPath = `${dirPath}/${baseName}`;
    const deepReadable = isDirectory(distPath);

    if (baseName.indexOf('.') === 0 || (!deepReadable && !distPath.endsWith('.md'))) {
      return;
    }

    const newPaths = [].concat(paths, baseName);

    if (deepReadable) {
      readDirDeeply(distPath, newPaths.slice(), callback);
    } else {
      callback(baseName, newPaths.slice());
    }
  });
}

function resolvePageSlug(baseName, paths) {
  const dirPath = paths.join('/');

  return baseName === 'index.md' ? dirPath : `${dirPath}/${baseName.replace('.md', '')}`;
}

function copyRefImageFile(imgSrc, dataSrc, srcDir, distDir) {
  if (imgSrc.indexOf('http') === 0 || imgSrc.indexOf('/') === 0) {
    return;
  }

  const resolvedImgSrc = resolvePath(srcDir, imgSrc);
  const resolvedImgPartial = resolvedImgSrc.replace(`${dataSrc}/`, '');
  const dirNames = resolvedImgPartial.split('/').slice(0, -1);

  if (dirNames.length > 0) {
    ensureDirExists(`${distDir}/${dirNames.join('/')}`);
  }

  cp(resolvedImgSrc, `${distDir}/${resolvedImgPartial}`);
}

function orderDocTree(docs) {
  const childless = [];
  const children = [];

  let indexDoc;

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

  return [].concat(childless, children);
}

function resolveDocData(docs) {
  const root = {};

  docs.forEach(doc => {
    const pathParts = [].concat(doc.dirPaths, doc.baseName);

    let currentNode = root;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts.slice(0, i + 1).join('/');

      let child;

      if (currentNode.children) {
        child = currentNode.children.find(child => child.uri === part);
      }

      if (!child) {
        child = {};

        if (i === pathParts.length - 1 && doc.title) {
          child.title = doc.title;
        }

        child.uri = part;

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

function generateFileBasedSpecData(srcPath, dataSourcePath, options = {}) {
  const { permalink = '/:path/' } = readMeta(dataSourcePath) || {};
  const { sourceKey, dataDir, docDir, imageDir, formatter } = options;

  const generatedDataDirPath = `${srcPath}/${dataDir}/knosys/${sourceKey}`;
  const generatedFileDirPath = `${srcPath}/${docDir}/${sourceKey}`;
  const generatedImageDirPath = `${srcPath}/${imageDir}/knosys/${sourceKey}`

  ensureDirExists(generatedDataDirPath, true);
  ensureDirExists(generatedFileDirPath, true);
  ensureDirExists(generatedImageDirPath, true);

  const docs = [];

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
      [].concat(
          Array.from(frontMatter.content.matchAll(/!\[([^\[\]]+)?\]\(([^\(\)]+)\)/g)),
          Array.from(frontMatter.content.matchAll(/<img([^>]+)src=["']([^"']*)["'][^>]*>/gi)),
        )
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

  saveData(`${generatedDataDirPath}/docs.yml`, resolveDocData(docs));
}

module.exports = { generateFileBasedSpecData };
