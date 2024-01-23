const { execSync } = require('child_process');

function addModule(moduleName, moduleOrigin, modulePath) {
  execSync(`git submodule add --name ${moduleName} ${moduleOrigin} ${modulePath}`, { stdio: 'inherit' });
}

function updateModule(gitModulePath) {
  execSync(`git submodule update --remote ${gitModulePath}`, { stdio: 'inherit' });
}

module.exports = { addModule, updateModule };
