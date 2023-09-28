const { execSync } = require('child_process');

function cp(fromPath, toPath) {
  execSync(`cp ${fromPath} ${toPath}`, { stdio: 'inherit' });
}

function rm(fileOrDirPath) {
  execSync(`rm -rf ${fileOrDirPath}`, { stdio: 'inherit' });
}

function mkdir(dirPath) {
  execSync(`mkdir -p ${dirPath}`, { stdio: 'inherit' });
}

function touch(filePath) {
  execSync(`touch ${filePath}`, { stdio: 'inherit' });
}

module.exports = { cp, rm, mkdir, touch };
