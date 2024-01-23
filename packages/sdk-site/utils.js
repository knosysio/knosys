const { existsSync } = require('fs');
const { execSync } = require('child_process');
const { isFunction, saveData: cacheData } = require('@ntks/toolbox');

const { DEFAULT_PATH_SCHEMA } = require('../sdk-core/constants');
const {
  resolvePathFromParams,
  ensureDirExists, readDirDeeply, readMeta, readEntity, saveData,
  getGlobalConfigDirPath,
} = require('../sdk-core');

function resolvePermalink(schema, params) {
  return schema.split('/').map(seg => {
    if (seg === '' || !/^\:[0-9a-z-_]+$/i.test(seg)) {
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

function generateSiteData(srcPath, dataSourcePath, options = {}) {
  const { path = DEFAULT_PATH_SCHEMA, permalink } = readMeta(dataSourcePath) || {};
  const paramArr = path.split('/').map(part => part.slice(1));

  if (!['category', 'collection'].includes(paramArr[0])) {
    return;
  }

  const categorized = paramArr[0] === 'category';
  const siteDataMap = {};

  const { dataDir, docDir, formatter } = options;

  const siteDataRootPath = `${srcPath}/${dataDir}`;
  const generatedDataDirPath = `${siteDataRootPath}/knosys`;
  const generatedFileDirPath = `${srcPath}/${docDir}`;

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

    if (frontMatter.content && isFunction(formatter)) {
      frontMatter.content = formatter(frontMatter.content);
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

function deploySite(siteName, config, generator) {
  if (!isFunction(generator)) {
    return;
  }

  let deployRepo;
  let deployBranch;
  let cnameDomain;

  if (config) {
    deployRepo = config.git.url;
    deployBranch = config.git.branch || 'master';
    cnameDomain = config.cname;
  }

  if (!deployRepo || !deployBranch) {
    return;
  }

  const globalConfigDirPath = getGlobalConfigDirPath();
  const siteTempPath = `${globalConfigDirPath}/sites`;

  ensureDirExists(globalConfigDirPath);
  ensureDirExists(siteTempPath);

  const deployDir = `${siteTempPath}/${config.alias || siteName || 'unnamed'}`;

  function exec(cmds) {
    const cmdStr = cmds.join(' && ');

    console.log(`\r\n[INFO] 执行命令 ${cmdStr}\r\n`);

    return execSync(cmdStr, { stdio: 'inherit', cwd: deployDir });
  }

  function execInTarget(cmd) {
    return execSync(cmd, { cwd: deployDir }).toString('utf-8').trim();
  }

  if (existsSync(deployDir)) {
    exec([`git pull origin ${deployBranch}`]);
  } else {
    ensureDirExists(deployDir);
    exec([
      'git init',
      `git remote add origin ${deployRepo}`,
      'git fetch',
    ]);

    let branchExists;

    try {
      branchExists = !!execInTarget(`git branch -a | grep remotes/origin/${deployBranch}`);
    } catch (err) {
      branchExists = false;
    }

    exec([`git checkout ${branchExists ? '' : '-b '}${deployBranch}`]);
  }

  setTimeout(() => {
    generator(deployDir);

    if (cnameDomain) {
      exec([
        'rm -rf CNAME',
        'touch CNAME',
        `echo ${cnameDomain} > CNAME`
      ]);
    }

    exec([
      'git add -A',
      `git commit -m "build: generate and deploy via KnoSys on ${new Date()}"`,
      `git push origin ${deployBranch}`
    ]);
  }, 0);
}

module.exports = { generateSiteData, deploySite };
