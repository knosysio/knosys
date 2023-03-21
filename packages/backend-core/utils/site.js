const { existsSync } = require('fs');
const { resolve: resolvePath } = require('path');
const { execSync } = require('child_process');
const { isFunction } = require('@ntks/toolbox');

const { GLOBAL_DIR_NAME } = require('../constants');
const { ensureDirExists } = require('./fs');

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

  const globalConfigDirPath = resolvePath(process.env.HOME || process.env.USERPROFILE, GLOBAL_DIR_NAME);
  const siteTempPath = `${globalConfigDirPath}/sites`;

  ensureDirExists(globalConfigDirPath);
  ensureDirExists(siteTempPath);

  const deployDir = `${siteTempPath}/${config.alias || siteName || 'unnamed'}`;

  function exec(cmds) {
    const cmdStr = cmds.join(' && ');

    console.log(`\r\n[INFO] 执行命令 ${cmdStr}\r\n`);

    return execSync(cmdStr, { stdio: 'inherit', cwd: deployDir });
  }

  if (existsSync(deployDir)) {
    exec([`git pull origin ${deployBranch}`]);
  } else {
    ensureDirExists(deployDir);
    exec([
      'git init',
      `git remote add origin ${deployRepo}`,
      'git fetch',
      `git checkout ${deployBranch}`
    ]);
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

module.exports = { deploySite };
