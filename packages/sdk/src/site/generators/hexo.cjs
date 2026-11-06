const { resolve: resolvePath, join: joinPath } = require('path');
const { existsSync } = require('fs');
const { execSync } = require('child_process');

const { ENTITY_CONTENT_NAME, touch, rm, isLocalRelative, scanAndSortByAsc, copyFileDeeply } = require('../../core');
const { generateSiteData } = require('../utils');

function resolveLiquidImagePath({ spec, imageDir, slug }, match, srcPath) {
  if (srcPath.indexOf('http') === 0) {
    return match;
  }

  let resolvedImgSrc;

  if (spec === 'qiidb') {
    resolvedImgSrc = `${slug}/${srcPath}`;
  } else if (spec === 'file') {
    const idParts = slug.split('/');

    if (idParts.length > 1) {
      resolvedImgSrc = joinPath(idParts.slice(0, -1).join('/'), srcPath.indexOf('./') === 0 ? srcPath.slice(2) : srcPath);
    } else {
      resolvedImgSrc = joinPath(slug, srcPath);
    }
  }

  return match.replace(srcPath, `/${imageDir}/${resolvedImgSrc}`);
}

function isRelativeEntity(link, { entitySrc, pathSchema }) {
  if (!isLocalRelative(link)) {
    return false;
  }

  const relativeEntityPath = resolvePath(entitySrc, link);

  if (!existsSync(relativeEntityPath)) {
    return false;
  }

  return link.split('/').filter(part => part === '..').length <= pathSchema.split('/').length;
}

function resolveLink(raw, params) {
  return raw.replace(/\[([^\[\]]+)\]\(([^\(\)]+)\)/g, (match, _, link) => {
    // internal page of site
    if (link.indexOf('/') === 0) {
      return match;
    }

    // external link
    if (link.indexOf('http') === 0) {
      return `${match}`;
    }

    if (params.spec === 'file') {
      let resolvedLink = link.startsWith('./') || link.startsWith('../') ? link : `./${link}`;

      if (params.entityBaseName !== 'index.md') {
        resolvedLink = resolvedLink.startsWith('./') ? `.${resolvedLink}` : `../${resolvedLink}`;
      }

      return match.replace(`(${link})`, `(${resolvedLink.replace(/(\/index)?\.md$/, '/')})`);
    }

    // relative entity path
    if (params.spec === 'qiidb' && isRelativeEntity(link, params)) {
      return match.replace(link, link.replace(ENTITY_CONTENT_NAME, ''));
    }

    return `\`[KNOSYS_ERR: invalid path in '${match}']\``;
  });
}

function generateHexoData(srcPath, dataSourcePath, sourceKey) {
  generateSiteData(srcPath, dataSourcePath, {
    sourceKey,
    dataDir: 'source/_data',
    docDir: 'source/knosys',
    imageDir: 'source',
    formatter: (content, params) => content
      .replace(/(!)?\[([^\[\]]+)?\]\(([^\(\)]+)\)/g, (match, hashbang, _, srcPath) => hashbang ? resolveLiquidImagePath(params, match, srcPath) : resolveLink(match, params))
      .replace(/(?:\<img (?:.+)?)src=\"([^\"]+)\"/g, resolveLiquidImagePath.bind(null, params))
  });
}

function serveHexoSite(srcPath) {
  const flags = [
    `--source ${srcPath}`,
    `--cwd ${srcPath}`,
    `--config ${srcPath}/_config.yml`,
  ];

  execSync(`cd ${srcPath} && hexo server ${flags.join(' ')}`, { stdio: 'inherit' });
}

function generateHexoSite(srcPath, distPath) {
  const flags = [
    `--source ${srcPath}`,
    `--cwd ${srcPath}`,
    `--config ${srcPath}/_config.yml`,
    '-b',
    '-f',
  ];
  const publicPath = `${srcPath}/public`;

  rm(`${srcPath}/db.json`);
  execSync(`cd ${srcPath} && NODE_ENV=production hexo generate ${flags.join(' ')}`, { stdio: 'inherit' });

  scanAndSortByAsc(distPath).forEach(baseName => !['.git', '.github'].includes(baseName) && rm(`${distPath}/${baseName}`));
  copyFileDeeply(publicPath, distPath, [], true);
  rm(publicPath);
  touch(`${distPath}/.nojekyll`);
}

module.exports = { generateHexoData, serveHexoSite, generateHexoSite };
