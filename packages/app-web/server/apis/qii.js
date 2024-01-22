const { existsSync } = require('fs');
const { isNumeric } = require('@ntks/toolbox');
const router = require('@koa/router')();

const { readEntity, readData, saveData, rm } = require('../../../backend-core');
const { getDataSourcePath } = require('./helper');

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
    data: total > 0 ? records.slice(startPos, startPos + resolvedSize) : [],
    extra: {
      total,
      pageSize: resolvedSize,
      pageNum: resolvedNum,
    },
  };
}

function readDb(ctx) {
  return readData(ctx.state.KNOSYS_DB_PATH) || {};
}

function updateDb(ctx, data) {
  return saveData(ctx.state.KNOSYS_DB_PATH, data);
}

function resolveData(ctx, callback) {
  const db = readDb(ctx);
  const { collection } = ctx.query;

  if (db[collection]) {
    ctx.body = callback(db[collection]);
  } else {
    ctx.body = { success: false, message: `数据集合 \`${collection}\` 不存在` };
  }
}

function resolveRecord(ctx, callback) {
  return resolveData(ctx, collectionInfo => {
    const { id } = ctx.query;
    const found = (collectionInfo.records || []).find(record => record.id === id);

    if (!found) {
      return { success: false, message: `记录 \`${id}\` 不存在` };
    }

    const dataSourcePath = getDataSourcePath(ctx);

    if (!dataSourcePath) {
      return { success: false, message: `数据源 \`${dataSourcePath}\` 不存在` };
    }

    const collectionRecordPath = `${collectionInfo.path}/${found.path}`;
    const recordFullPath = `${dataSourcePath}/${collectionRecordPath}`;

    if (!existsSync(recordFullPath)) {
      return { success: false, message: `记录数据 \`${collectionRecordPath}\` 不存在` };
    }

    try {
      const entity = readEntity(recordFullPath);

      ['banner', 'cover'].forEach(k => {
        if (found[k]) {
          entity[k] = found[k];
        }
      });

      return callback({ path: recordFullPath, data: entity });
    } catch (err) {
      return { success: false, message: JSON.stringify(err, null, 2) };
    }
  });
}

router.get('/query', ctx => resolveData(ctx, collectionInfo => {
  const { pageSize = defaultSize, pageNum = defaultNum } = ctx.query;

  return { success: true, ...paginate((collectionInfo.records || []).slice().reverse(), pageNum, pageSize) };
}));

router.get('/get', ctx => resolveRecord(ctx, record => ({ success: true, data: record.data })));

router.delete('/remove', ctx => resolveRecord(ctx, record => {
  rm(record.path);

  const db = readDb(ctx);
  const { collection, id } = ctx.query;

  db[collection].records = db[collection].records.filter(item => item.id !== id);

  updateDb(ctx, db);

  return { success: true, data: record.data }
}));

module.exports = router;
