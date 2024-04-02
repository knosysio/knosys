const { isFunction, saveData: cacheData } = require('@ntks/toolbox');

const {
  DEFAULT_PATH_SCHEMA,
  resolvePathFromParams,
  ensureDirExists, getImageFileNames, readDirDeeply, readMeta, readEntity, saveData,
  cp,
} = require('../../sdk-core');

const { resolvePermalink } = require('./helper');

function saveCollectionData(dirPath, collectionMap) {
  Object.entries(collectionMap).forEach(([collection, data]) => {
    delete data.__meta;

    saveData(`${dirPath}/${collection}.yml`, data);
  });
}

function generateQiiDBSpecData(srcPath, dataSourcePath, options = {}) {
  const { path = DEFAULT_PATH_SCHEMA, permalink } = readMeta(dataSourcePath) || {};
  const paramArr = path.split('/').map(part => part.slice(1));

  if (!['category', 'collection'].includes(paramArr[0])) {
    return;
  }

  const categorized = paramArr[0] === 'category';
  const siteDataMap = {};

  const { sourceKey, dataDir, docDir, imageDir, formatter } = options;

  const generatedDataDirPath = `${srcPath}/${dataDir}/knosys/${sourceKey}`;
  const generatedFileDirPath = `${srcPath}/${docDir}/${sourceKey}`;
  const generatedImageDirPath = `${srcPath}/${imageDir}/knosys/${sourceKey}`;

  ensureDirExists(generatedDataDirPath, true);
  ensureDirExists(generatedFileDirPath, true);
  ensureDirExists(generatedImageDirPath, true);

  readDirDeeply(dataSourcePath, paramArr, {}, (baseName, params) => {
    const entityDirPath = `${dataSourcePath}/${resolvePathFromParams(paramArr.join('/'), params)}`;
    const entity = readEntity(entityDirPath);

    if (!entity) {
      return;
    }

    const { category = '__uncategorized', collection, slug } = params;
    const entityImageNames = getImageFileNames(entityDirPath);

    let generatedCollectionDirPath;
    let collectionDir;

    if (categorized) {
      const generatedCategoryDirPath = `${generatedFileDirPath}/${category}`;

      generatedCollectionDirPath = `${generatedCategoryDirPath}/${collection}`;
      collectionDir = `${category}/${collection}`;

      ensureDirExists(generatedCategoryDirPath);
    } else {
      generatedCollectionDirPath = `${generatedFileDirPath}/${collection}`;
      collectionDir = collection;
    }

    cacheData(siteDataMap, `${category}.${collection}.items.${slug}`, entity, true);
    cacheData(siteDataMap, `${category}.${collection}.sequence`, [...(siteDataMap[category][collection].sequence || []), slug]);

    let collectionSourceDirPath;

    if (categorized) {
      const categorySourceDirPath = `${dataSourcePath}/${category}`;

      collectionSourceDirPath = `${categorySourceDirPath}/${collection}`;

      if (!siteDataMap[category].__meta) {
        siteDataMap[category].__meta = readMeta(categorySourceDirPath) || {};
      }
    } else {
      collectionSourceDirPath = `${dataSourcePath}/${collection}`;
    }

    if (!siteDataMap[category][collection].__meta) {
      siteDataMap[category][collection].__meta = readMeta(collectionSourceDirPath) || {};
    }

    const permalinkSchema = siteDataMap[category][collection].__meta.permalink || (siteDataMap[category].__meta || {}).permalink || permalink;
    const frontMatter = { ...entity };

    if (permalinkSchema && !frontMatter.permalink) {
      frontMatter.permalink = resolvePermalink(permalinkSchema, params);
    }

    if (frontMatter.content && isFunction(formatter)) {
      frontMatter.content = formatter(frontMatter.content, {
        spec: 'qiidb',
        pathSchema: path,
        slug,
        imageDir: `knosys/${sourceKey}/${collectionDir}`,
        entitySrc: entityDirPath,
        entityBaseName: baseName,
      });
    }

    if (entityImageNames.length > 0) {
      const generatedEntityImageDirPath = `${generatedImageDirPath}/${collectionDir}/${slug}`;

      ensureDirExists(generatedEntityImageDirPath, true);
      entityImageNames.forEach(imageBaseName => cp(`${entityDirPath}/${imageBaseName}`, `${generatedEntityImageDirPath}/${imageBaseName}`));
    }

    ensureDirExists(generatedCollectionDirPath, siteDataMap[category][collection].sequence.length === 0);
    saveData(`${generatedCollectionDirPath}/${slug}.md`, frontMatter.content || '', frontMatter);
  });

  if (categorized) {
    Object.entries(siteDataMap).forEach(([category, collectionMap]) => {
      const categoryDataDirPath = `${generatedDataDirPath}/${category}`;

      delete collectionMap.__meta;

      ensureDirExists(categoryDataDirPath);
      saveCollectionData(categoryDataDirPath, collectionMap);
    });
  } else {
    saveCollectionData(generatedDataDirPath, siteDataMap.__uncategorized);
  }
}

module.exports = { generateQiiDBSpecData };
