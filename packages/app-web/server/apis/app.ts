import { resolve as resolvePath } from 'path';
import { existsSync } from 'fs';
import { pick } from '@ntks/toolbox';
import Router from '@koa/router';
import { DEFAULT_PATH_SCHEMA, readDirDeeply, readData, updateData, readMeta, updateConfig } from '@knosys/sdk';
import { getGlobalAppRootDirPath, getAppConfig } from '@knosys/sdk/src/app';
import { getAppDataPath, getDataSourcePath } from './helper';

const router = new Router();

function getAppConfigFromSource(dataSourcePath: string): any {
  return {
    path: DEFAULT_PATH_SCHEMA,
    logo: '',
    ...pick(readMeta(dataSourcePath), ['path']),
    ...getAppConfig(resolvePath(dataSourcePath, '../')),
  };
}

router.get('/list', (ctx: any) => {
  const appRootPath = getGlobalAppRootDirPath();
  const apps: any[] = [];

  if (existsSync(appRootPath)) {
    readDirDeeply(appRootPath, ['app'], {}, (baseName: string) => {
      const appConfig = readData(`${appRootPath}/${baseName}/app.json`) || {};

      if (appConfig.source) {
        apps.push({ ...getAppConfigFromSource(appConfig.source), ...appConfig });
      }
    });
  }

  ctx.body = { success: true, data: apps };
});

router.get('/one', (ctx: any) => {
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

router.put('/one', (ctx: any) => {
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

export default router;
