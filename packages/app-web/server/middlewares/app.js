const { existsSync } = require('fs');

const { getGlobalAppDirPath } = require('../../../backend-app');

function getAppName(ctx) {
  return ctx.headers['x-knosys-app'];
}

function getAppPath(ctx) {
  const appPath = getGlobalAppDirPath(getAppName(ctx));

  return existsSync(appPath) ? appPath : '';
}

function getDbPath(ctx) {
  const appPath = getAppPath(ctx);

  if (!appPath) {
    return '';
  }

  ctx.state.KNOSYS_APP_PATH = appPath;

  const dbPath = `${appPath}/db.json`;

  return existsSync(dbPath) ? dbPath : '';
}

async function checkAppConfig(ctx, next) {
  const dbPath = getDbPath(ctx);

  let message;

  if (dbPath) {
    ctx.state.KNOSYS_DB_PATH = dbPath;
  } else {
    message = `应用 \`${getAppName(ctx)}\` 的数据文件不存在`;
  }

  if (message) {
    ctx.body = { success: false, message };
  } else {
    await next();
  }
}

module.exports = { checkAppConfig };
