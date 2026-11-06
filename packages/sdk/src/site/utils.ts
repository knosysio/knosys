import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { isFunction } from '../compat/utils';

import { rm, touch, ensureDirExists, readMeta, getGlobalConfigDirPath } from '../core';

import { DEFAULT_DDS_TYPE } from './constants';
import { generateQiiDBSpecData, generateFileBasedSpecData } from './specs';

const specs = {
  qiidb: generateQiiDBSpecData,
  file: generateFileBasedSpecData,
};

/**
 * Generate site data
 */
export function generateSiteData(...args: any[]): void {
  const { spec = DEFAULT_DDS_TYPE } = readMeta(args[1]) || {};
  const dataGen = specs[spec as keyof typeof specs];

  if (!isFunction(dataGen)) {
    return;
  }

  dataGen(args[0], args[1], args[2]);
}

/**
 * Deploy site
 */
export function deploySite(siteName: string, config: any, generator: Function): void {
  if (!isFunction(generator)) {
    return;
  }

  let deployRepo: string = '';
  let deployBranch: string = '';
  let cnameDomain: string = '';

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

  function exec(cmds: string[]): Buffer {
    const cmdStr = cmds.join(' && ');

    console.log(`\r\n[INFO] 执行命令 ${cmdStr}\r\n`);

    return execSync(cmdStr, { stdio: 'inherit', cwd: deployDir });
  }

  function execInTarget(cmd: string): string {
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

    let branchExists: boolean;

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
      const cnamePath = `${deployDir}/CNAME`;

      rm(cnamePath);
      touch(cnamePath);
      exec([`echo ${cnameDomain} > CNAME`]);
    }

    exec([
      'git add -A',
      `git commit -m "build: generate and deploy via KnoSys on ${new Date()}"`,
      `git push origin ${deployBranch}`
    ]);
  }, 0);
}
