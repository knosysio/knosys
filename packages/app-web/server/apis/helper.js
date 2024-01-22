const { readData } = require('../../../backend-core');

function getAppData(ctx) {
  return readData(`${ctx.state.KNOSYS_APP_PATH}/app.json`) || {};
}

function getDataSourcePath(ctx) {
  return getAppData(ctx).source || '';
}

module.exports = {
  getAppData,
  getDataSourcePath,
};
