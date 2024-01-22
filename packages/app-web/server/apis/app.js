const { resolve: resolvePath } = require('path');
const { pick } = require('@ntks/toolbox');
const router = require('@koa/router')();

const { DEFAULT_PATH_SCHEMA, readMeta } = require('../../../backend-core');
const { getAppConfig } = require('../../../backend-app');

const { getAppData } = require('./helper');

router.get('/get', ctx => {
  const { source: dataSourcePath, ...others } = getAppData(ctx);

  if (dataSourcePath) {
    const appConfig = getAppConfig(resolvePath(dataSourcePath, '../'));

    ctx.body = {
      success: true,
      data: {
        path: DEFAULT_PATH_SCHEMA,
        logo: '',
        ...pick(readMeta(dataSourcePath), ['path']),
        ...appConfig,
        ...pick(others, ['logo'])
      },
    };
  } else {
    ctx.body = { success: false, message: `数据源 \`${dataSourcePath}\` 不存在` };
  }
});

module.exports = router;
