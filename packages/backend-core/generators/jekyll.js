const { existsSync } = require('fs');
const { execSync } = require('child_process');
const { saveData: cacheData } = require('@ntks/toolbox');

const { DEFAULT_PATH_SCHEMA } = require('../constants');
const { ensureDirExists, readDirDeeply, copyFileDeeply, readMeta, readEntity, saveData, resolvePathFromParams, resolveRootPath } = require('../utils');

function copyJekyllTheme(srcPath, themePath) {
  // only copy resources for now (pages are not included)
  [
    ...['fonts', 'images', 'javascripts', 'stylesheets'].map(assetDir => `_assets/${assetDir}`),
    '_includes',
    '_layouts'
  ].forEach(dirPath => {
    const srcDir = `${dirPath}/ksio`;
    const distPath = `${srcPath}/${srcDir}`;

    ensureDirExists(distPath, true);

    copyFileDeeply(`${themePath}/${srcDir}`, distPath);
  });
}

function resolvePermalink(schema, params) {
  return schema.split('/').map(seg => {
    if (seg === '') {
      return seg;
    }

    const param = seg.slice(1);

    return params[param === 'path' ? 'slug' : param];
  }).join('/')
}

function saveCollectionData(dirPath, collectionMap) {
  Object.entries(collectionMap).forEach(([collection, data]) => {
    delete data.__meta;

    saveData(`${dirPath}/${collection}.yml`, data);
  });
}

function generateJekyllData(srcPath, dataSourcePath) {
  const { path = DEFAULT_PATH_SCHEMA, permalink } = readMeta(dataSourcePath) || {};
  const paramArr = path.split('/').map(part => part.slice(1));

  if (!['category', 'collection'].includes(paramArr[0])) {
    return;
  }

  const categorized = paramArr[0] === 'category';
  const siteDataMap = {};

  const siteDataRootPath = `${srcPath}/_data`;
  const generatedDataDirPath = `${siteDataRootPath}/knosys`;
  const generatedFileDirPath = `${srcPath}/_knosys`;

  ensureDirExists(siteDataRootPath);
  ensureDirExists(generatedDataDirPath, true);
  ensureDirExists(generatedFileDirPath, true);

  readDirDeeply(dataSourcePath, paramArr, {}, (_, params) => {
    const entity = readEntity(`${dataSourcePath}/${resolvePathFromParams(paramArr.join('/'), params)}`);

    if (!entity) {
      return;
    }

    const { category = '__uncategorized', collection, slug } = params;

    let generatedCollectionDirPath;

    if (categorized) {
      const generatedCategoryDirPath = `${generatedFileDirPath}/${category}`;

      generatedCollectionDirPath = `${generatedCategoryDirPath}/${collection}`;

      ensureDirExists(generatedCategoryDirPath);
    } else {
      generatedCollectionDirPath = `${generatedFileDirPath}/${collection}`;
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

    if (frontMatter.content) {
      const langs = { vue: 'html' };

      frontMatter.content = frontMatter.content.replace(/\n\`{3}([^\n]+)/g, (_, lang) => `\n{% highlight ${langs[lang] || lang} %}`).replace(/\`{3}/g, '{% endhighlight %}');
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

function serveJekyllSite(srcPath) {
  const flags = [
    `--source ${srcPath}`,
    `--destination ${srcPath}/_site`,
    `--config ${srcPath}/_config.yml`,
    '--future',
    '--drafts',
    '--incremental',
  ];

  execSync(`bundle exec jekyll serve ${flags.join(' ')}`, { stdio: 'inherit', cwd: srcPath });
}

function generateJekyllSite(srcPath, distPath) {
  const flags = [
    `--source ${srcPath}`,
    `--destination ${distPath}`,
    `--config ${srcPath}/_config.yml`,
  ];

  execSync([
    'bundle exec jekyll clean',
    `JEKYLL_ENV=production bundle exec jekyll build ${flags.join(' ')}`,
  ].join(' && '), { stdio: 'inherit', cwd: srcPath });
  execSync('touch .nojekyll', { stdio: 'inherit', cwd: distPath });
}

module.exports = { copyJekyllTheme, generateJekyllData, serveJekyllSite, generateJekyllSite };
