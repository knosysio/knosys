const { existsSync } = require('fs');
const { execSync } = require('child_process');
const { isFunction } = require('@ntks/toolbox');

const { ensureDirExists, readMeta, getGlobalConfigDirPath } = require('../sdk-core');

const { DEFAULT_DDS_TYPE } = require('./constants');
const { generateQiiDBSpecData, generateFileBasedSpecData } = require('./specs');

const specs = {
  qiidb: generateQiiDBSpecData,
  file: generateFileBasedSpecData,
};

function generateSiteData(...args) {
  const { spec = DEFAULT_DDS_TYPE } = readMeta(args[1]) || {};
  const dataGen = specs[spec];

  if (!isFunction(dataGen)) {
    return;
  }

  dataGen(...args);
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
