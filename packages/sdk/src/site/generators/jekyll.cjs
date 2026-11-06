const { resolve: resolvePath, join: joinPath } = require('path');
const { existsSync } = require('fs');
const { execSync } = require('child_process');

const { ENTITY_CONTENT_NAME, touch, isLocalRelative, ensureDirExists, copyFileDeeply } = require('../../core');
const { generateSiteData } = require('../utils');

function copyJekyllTheme(srcPath, themePath) {
  // only copy resources for now (pages are not included)
  [
    ...['fonts', 'images', 'javascripts', 'stylesheets'].map(assetDir => `_assets/${assetDir}`),
    '_includes',
    '_layouts'
  ].forEach(dirPath => {
    const srcDir = `${dirPath}/ksio`;
    const distPath = `${srcPath}/${srcDir}`;

    ensureDirExists(`${srcPath}/${dirPath}`);
    ensureDirExists(distPath, true);

    copyFileDeeply(`${themePath}/${srcDir}`, distPath);
  });
}

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

  return match.replace(srcPath, `{{ '${imageDir}/${resolvedImgSrc.replace(/.(jp(e)?g|png|gif|svg)/g, '')}' | asset_path }}`);
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
      return `${match}{:target="_blank"}{:rel="external nofollow"}`;
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

function replaceCodeBlock(raw) {
  const langs = {
    vue: 'html', yml: 'yaml', json5: 'javascript',
    csv: 'text', graphql: 'text', mermaid: 'text', xlang: 'text',
  };

  return raw.replace(/```(.*?)\n([\s\S]*?)\n```/gm, (_, lang, code) => `{% highlight ${lang ? (langs[lang] || lang) : 'text'} %}{% raw %}\n${code.trim()}\n{% endraw %}{% endhighlight %}`);
}

function generateJekyllData(srcPath, dataSourcePath, sourceKey) {
  generateSiteData(srcPath, dataSourcePath, {
    sourceKey,
    dataDir: '_data',
    docDir: '_knosys',
    imageDir: '_assets/images',
    formatter: (content, params) => replaceCodeBlock(content)
      .replace(/(!)?\[([^\[\]]+)?\]\(([^\(\)]+)\)/g, (match, hashbang, _, srcPath) => hashbang ? resolveLiquidImagePath(params, match, srcPath) : resolveLink(match, params))
      .replace(/(?:\<img (?:.+)?)src=\"([^\"]+)\"/g, resolveLiquidImagePath.bind(null, params))
  });
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
  touch(`${distPath}/.nojekyll`);
}

module.exports = { copyJekyllTheme, generateJekyllData, serveJekyllSite, generateJekyllSite };
