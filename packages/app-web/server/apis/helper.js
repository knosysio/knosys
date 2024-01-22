const { readData } = require('../../../backend-core');

function getAppDataPath(ctx) {
  return `${ctx.state.KNOSYS_APP_PATH}/app.json`;
}

function getDataSourcePath(ctx) {
  return (readData(getAppDataPath(ctx)) || {}).source || '';
}

module.exports = {
  getAppDataPath,
  getDataSourcePath,
};
