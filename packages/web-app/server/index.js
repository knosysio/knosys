const { existsSync } = require('fs');
const Koa = require('koa');
const Router = require('@koa/router');
const { isNumeric } = require('@ntks/toolbox');

const { getGlobalConfigDirPath, readData } = require('../../backend-core/utils');

const app = new Koa();
const router = new Router({ prefix: '/api' });

const appTempPath = `${getGlobalConfigDirPath()}/apps`;

const defaultSize = 20;
const defaultNum = 1;

function paginate(records, pageNum, pageSize) {
  let resolvedSize;
  let resolvedNum;

  if (isNumeric(pageSize)) {
    resolvedSize = +pageSize > 0 ? Math.floor(+pageSize) : defaultSize;
  } else {
    resolvedSize = defaultSize;
  }

  if (isNumeric(pageNum)) {
    resolvedNum = +pageNum > 0 ? Math.floor(+pageNum) : defaultNum;
  } else {
    resolvedNum = defaultNum;
  }

  const startPos = (resolvedNum - 1) * resolvedSize;
  const total = records.length;

  return {
    list: total > 0 ? records.slice(startPos, startPos + resolvedSize) : [],
    total,
    pageSize: resolvedSize,
    pageNum: resolvedNum,
  };
}

router.get('/query', ctx => {
  const appName = ctx.headers['x-knosys-app'];
  const dbPath = `${appTempPath}/${appName}/db.json`;

  if (appName && existsSync(dbPath)) {
    const db = readData(dbPath) || {};
    const { collection, pageSize = defaultSize, pageNum = defaultNum } = ctx.query;

    ctx.body = paginate((db[collection] && db[collection].records || []).slice().reverse(), pageNum, pageSize);
  } else {
    ctx.body = 'Something wrong!';
  }
});

app.use(router.routes()).use(router.allowedMethods());

app.listen(8001, () => console.log('接口服务启动了'));
