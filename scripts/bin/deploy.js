const { existsSync } = require('fs');
const { resolve: resolvePath } = require('path');
const { execSync } = require('child_process');

const { ROOT_PATH, SITE_PATH, ensureDirExists, getConfig } = require('../helper');

function exec(cmdStr) {
  return execSync(cmdStr, { stdio: 'inherit' });
}

function deploySite() {
  const deployDir = resolvePath(ROOT_PATH, `../../.tmp/knosys`);
  const siteInfo = getConfig('site').default;

  let deployRepo;
  let deployBranch;
  let cnameDomain;

  if (siteInfo) {
    deployRepo = siteInfo.git.url;
    deployBranch = siteInfo.git.branch || 'master';
    cnameDomain = siteInfo.cname;
  }

  if (!deployRepo || !deployBranch) {
    return;
  }

  if (existsSync(deployDir)) {
    exec(`cd ${deployDir} && git pull origin ${deployBranch}`);
  } else {
    ensureDirExists(deployDir);
    exec(`cd ${deployDir} && git init && git remote add origin ${deployRepo} && git fetch && git checkout ${deployBranch}`);
  }

  const flags = [
    `--source ${SITE_PATH}`,
    `--destination ${deployDir}`,
    `--config ${SITE_PATH}/_config.yml`,
  ];

  exec(`cd ${ROOT_PATH} bundle exec jekyll clean && JEKYLL_ENV=production bundle exec jekyll build ${flags.join(' ')} && cd ${deployDir} && touch .nojekyll`);

  if (cnameDomain) {
    exec(`cd ${deployDir} && rm -rf CNAME && touch CNAME && echo ${cnameDomain} > CNAME`);
  }

  exec(`cd ${deployDir} && git add -A && git commit -m "build: generate and deploy via KnoSys on ${new Date()}" && git push origin ${deployBranch}`);
}

module.exports = { execute: deploySite };
