const { resolve: resolvePath } = require('path');
const { execSync } = require('child_process');

const { getGlobalAppDirPath, initApp } = require('../../sdk-app');

function serveApp(config) {
  const envVarStr = config ? `KNOSYS_APP_PATH=${encodeURIComponent(getGlobalAppDirPath(config.name))}` : '';
  const cmds = ['"npm run serve"', `"${envVarStr ? (envVarStr + ' ') : ''}npm run dev"`];

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
