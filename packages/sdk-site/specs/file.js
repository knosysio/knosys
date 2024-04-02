const { resolve: resolvePath } = require('path');
const { isFunction, saveData: cacheData } = require('@ntks/toolbox');

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

function generateFileBasedSpecData(srcPath, dataSourcePath, options = {}) {
  const { permalink = '/:path/' } = readMeta(dataSourcePath) || {};
  const { dataDir, docDir, imageDir, formatter } = options;

  // const generatedDataDirPath = `${srcPath}/${dataDir}/knosys`;
  const generatedFileDirPath = `${srcPath}/${docDir}`;
  const generatedImageDirPath = `${srcPath}/${imageDir}/knosys`

  // ensureDirExists(generatedDataDirPath, true);
  ensureDirExists(generatedFileDirPath, true);
  ensureDirExists(generatedImageDirPath, true);

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
          imageDir: 'knosys',
          entitySrc: srcDirPath,
          entityBaseName: baseName,
        });
      }
    }

    ensureDirExists(distDirPath);
    saveData(`${distDirPath}/${baseName}`, frontMatter.content || '', frontMatter);
  });
}

module.exports = { generateFileBasedSpecData };
