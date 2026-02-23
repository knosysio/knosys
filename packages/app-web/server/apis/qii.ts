import { existsSync } from 'fs';
import { isNumeric } from '@ntks/toolbox';
import Router from '@koa/router';
import { readEntity, readData, saveData, rm } from '@knosys/sdk';
import { getDataSourcePath } from './helper';

const router = new Router();

const defaultSize = 20;
const defaultNum = 1;

function paginate(records: any[], pageNum: any, pageSize: any): any {
  let resolvedSize: number;
  let resolvedNum: number;

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

function readDb(ctx: any): any {
  return readData(ctx.state.KNOSYS_DB_PATH) || {};
}

function updateDb(ctx: any, data: any): any {
  return saveData(ctx.state.KNOSYS_DB_PATH, data);
}

function resolveData(ctx: any, callback: (collectionInfo: any) => any): void {
  const db = readDb(ctx);
  const { collection } = ctx.query;

  if (db[collection]) {
    ctx.body = callback(db[collection]);
  } else {
    ctx.body = { success: false, message: `数据集合 \`${collection}\` 不存在` };
  }
}

function resolveRecord(ctx: any, callback: (record: { path: string; data: any }) => any): void {
  return resolveData(ctx, (collectionInfo: any) => {
    const { id } = ctx.query;
    const found = (collectionInfo.records || []).find((record: any) => record.id === id);

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

      ['banner', 'cover'].forEach((k: string) => {
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

router.get('/list', (ctx: any) => resolveData(ctx, (collectionInfo: any) => {
  const { pageSize = defaultSize, pageNum = defaultNum } = ctx.query;

  return { success: true, ...paginate((collectionInfo.records || []).slice().reverse(), pageNum, pageSize) };
}));

router.get('/one', (ctx: any) => resolveRecord(ctx, (record: any) => ({ success: true, data: record.data })));

router.delete('/one', (ctx: any) => resolveRecord(ctx, (record: any) => {
  rm(record.path);

  const db = readDb(ctx);
  const { collection, id } = ctx.query;

  db[collection].records = db[collection].records.filter((item: any) => item.id !== id);

  updateDb(ctx, db);

  return { success: true, data: record.data };
}));

export default router;
