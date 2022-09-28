const { execSync } = require('child_process');

function addGitModule(moduleName, moduleOrigin, modulePath) {
  execSync(`git submodule add --name ${moduleName} ${moduleOrigin} ${modulePath}`, { stdio: 'inherit' });
}

function updateGitModule(gitModulePath) {
  execSync(`git submodule update --remote ${gitModulePath}`, { stdio: 'inherit' });
}

module.exports = { addGitModule, updateGitModule };
