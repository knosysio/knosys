const { existsSync } = require('fs');
const { isNumeric } = require('@ntks/toolbox');
const router = require('@koa/router')();

const { getGlobalConfigDirPath, readData } = require('../../backend-core/utils');

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

function resolveData(ctx, callback) {
  const appName = ctx.headers['x-knosys-app'];
  const dbPath = `${appTempPath}/${appName}/db.json`;

  if (appName && existsSync(dbPath)) {
    const db = readData(dbPath) || {};
    const { collection } = ctx.query;

    if (db[collection]) {
      ctx.body = callback(db[collection]);
    } else {
      ctx.body = `Collection '${collection}' doesn't exist.`
    }
  } else {
    ctx.body = 'Something wrong!';
  }
}

router.get('/query', ctx => resolveData(ctx, collectionInfo => {
  const { pageSize = defaultSize, pageNum = defaultNum } = ctx.query;

  return paginate((collectionInfo.records || []).slice().reverse(), pageNum, pageSize);
}));

router.get('/get', ctx => resolveData(ctx, collectionInfo => {
  const { id } = ctx.query;

  return (collectionInfo.records || []).find(record => record.id === id);
}));

module.exports = router;
