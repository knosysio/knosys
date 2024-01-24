const { resolve: resolvePath } = require('path');
const { existsSync } = require('fs');
const { pick } = require('@ntks/toolbox');
const router = require('@koa/router')();

const { DEFAULT_PATH_SCHEMA, readDirDeeply, readData, updateData, readMeta, updateConfig } = require('../../../sdk-core');
const { getGlobalAppRootDirPath, getAppConfig } = require('../../../sdk-app');

const { getAppDataPath, getDataSourcePath } = require('./helper');

function getAppConfigFromSource(dataSourcePath) {
  return {
    path: DEFAULT_PATH_SCHEMA,
    logo: '',
    ...pick(readMeta(dataSourcePath), ['path']),
    ...getAppConfig(resolvePath(dataSourcePath, '../')),
  };
}

router.get('/list', ctx => {
  const appRootPath = getGlobalAppRootDirPath();
  const apps = [];

  if (existsSync(appRootPath)) {
    readDirDeeply(appRootPath, ['app'], {}, baseName => {
      const appConfig = readData(`${appRootPath}/${baseName}/app.json`) || {};

      if (appConfig.source) {
        apps.push({ ...getAppConfigFromSource(appConfig.source), ...appConfig });
      }
    });
  }

  ctx.body = { success: true, data: apps };
});

router.get('/one', ctx => {
  const { source: dataSourcePath, ...others } = readData(getAppDataPath(ctx)) || {};

  if (dataSourcePath) {
    ctx.body = {
      success: true,
      data: { ...getAppConfigFromSource(dataSourcePath), ...pick(others, ['logo']) },
    };
  } else {
    ctx.body = { success: false, message: `数据源 \`${dataSourcePath}\` 不存在` };
  }
});

router.put('/one', ctx => {
  const dataSourcePath = getDataSourcePath(ctx);

  if (dataSourcePath) {
    const changed = ctx.request.body;
    const basic = pick(changed, [/*'name', */'title']);

    if (Object.keys(basic).length > 0) {
      updateConfig({ app: basic }, resolvePath(dataSourcePath, '../'));
      updateData(getAppDataPath(ctx), basic);
    }

    ctx.body = { success: true };
  } else {
    ctx.body = { success: false, message: `数据源 \`${dataSourcePath}\` 不存在` };
  }

  ctx.status = 200;
});

module.exports = router;
