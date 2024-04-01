const { isFunction, saveData: cacheData } = require('@ntks/toolbox');

const {
  normalizeFrontMatter,
  isDirectory, scanAndSortByAsc, ensureDirExists, getImageFileNames,
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
    const imageNames = getImageFileNames(srcDirPath);
    const slug = resolvePageSlug(baseName, dirPaths);

    let frontMatter = readEntity(distDirPath) || {};

    if (content) {
      const normalized = normalizeFrontMatter(content);

      frontMatter = { ...(normalized.data || {}), content: normalized.content };
    }

    if (permalink && !frontMatter.permalink) {
      frontMatter.permalink = resolvePermalink(permalink, { slug });
    }

    if (frontMatter.content && isFunction(formatter)) {
      frontMatter.content = formatter(frontMatter.content, {
        pathSchema: '',
        slug,
        imageDir: 'knosys',
        entitySrc: srcDirPath,
      });
    }

    if (imageNames.length > 0) {
      const distImageDirPath = dirPaths.length > 0 ? `${generatedImageDirPath}/${dirPaths.join('/')}` : generatedImageDirPath;

      ensureDirExists(distImageDirPath, true);
      imageNames.forEach(imageBaseName => cp(`${srcDirPath}/${imageBaseName}`, `${distImageDirPath}/${imageBaseName}`));
    }

    ensureDirExists(distDirPath);
    saveData(`${distDirPath}/${baseName}`, frontMatter.content || '', frontMatter);
  });
}

module.exports = { generateFileBasedSpecData };
