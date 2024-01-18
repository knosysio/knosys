const { resolve: resolvePath } = require('path');
const { execSync } = require('child_process');

const { getGlobalAppDirPath, initApp } = require('../../backend-app');

function serveApp({ name }) {
  const encodedPath = encodeURIComponent(getGlobalAppDirPath(name));
  const cmds = ['"npm run serve"', `"KNOSYS_APP_PATH=${encodedPath} npm run dev"`];

  execSync(`npm run corun ${cmds.join(' ')}`, { stdio: 'inherit', cwd: resolvePath(__dirname, '../../app-web') });
}

module.exports = {
  execute: (subCmd = 'serve') => {
    if (subCmd !== 'serve') {
      return;
    }

    initApp().then(serveApp);
  },
};
