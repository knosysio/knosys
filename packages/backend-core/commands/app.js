const { resolve: resolvePath } = require('path');
const { execSync } = require('child_process')

const appDir = resolvePath(__dirname, '../../client-web');

module.exports = {
  execute: (subCmd = 'serve') => {
    if (subCmd !== 'serve') {
      return;
    }

    execSync('npm run dev', { stdio: 'inherit', cwd: appDir })
  },
};
