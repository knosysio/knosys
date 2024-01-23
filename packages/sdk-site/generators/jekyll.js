const { execSync } = require('child_process');

const { ensureDirExists, copyFileDeeply } = require('../../sdk-core');
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

function generateJekyllData(srcPath, dataSourcePath) {
  const langs = { vue: 'html', yml: 'yaml' };

  generateSiteData(srcPath, dataSourcePath, {
    dataDir: '_data',
    docDir: '_knosys',
    formatter: content => content
      .replace(/\n\`{3}([^\n]+)/g, (_, lang) => `\n{% highlight ${langs[lang] || lang} %}{% raw %}`)
      .replace(/\`{3}/g, '{% endraw %}{% endhighlight %}'),
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
  execSync('touch .nojekyll', { stdio: 'inherit', cwd: distPath });
}

module.exports = { copyJekyllTheme, generateJekyllData, serveJekyllSite, generateJekyllSite };
