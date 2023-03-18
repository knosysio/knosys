const { execSync } = require('child_process');

const { SITE_PATH } = require('../helper');

function serveSite() {
  const flags = [
    `--source ${SITE_PATH}`,
    `--config ${SITE_PATH}/_config.yml`,
    '--future',
    '--drafts',
    '--incremental',
  ];

  execSync(`bundle exec jekyll serve ${flags.join(' ')}`, { stdio: 'inherit' });
}

module.exports = { execute: serveSite };
