const { existsSync } = require('fs');

const { getGlobalAppDirPath } = require('../../../sdk-app');
const { API_PREFIX } = require('../constants');

function isSkipped(url) {
  return ['/app/list'].includes(url.replace(new RegExp(`^${API_PREFIX}`, 'i'), ''));
}

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
  if (isSkipped(ctx.url)) {
    await next();
  } else {
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
}

module.exports = { checkAppConfig };
