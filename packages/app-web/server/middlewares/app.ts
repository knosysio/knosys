import { existsSync } from 'fs';
import { getGlobalAppDirPath } from '@knosys/sdk/src/app';
import { API_PREFIX } from '../constants';

function isSkipped(url: string): boolean {
  return ['/app/list'].includes(url.replace(new RegExp(`^${API_PREFIX}`, 'i'), ''));
}

function getAppName(ctx: any): string {
  return ctx.headers['x-knosys-app'];
}

function getAppPath(ctx: any): string {
  const appPath = getGlobalAppDirPath(getAppName(ctx));
  return existsSync(appPath) ? appPath : '';
}

function getDbPath(ctx: any): string {
  const appPath = getAppPath(ctx);

  if (!appPath) {
    return '';
  }

  ctx.state.KNOSYS_APP_PATH = appPath;

  const dbPath = `${appPath}/db.json`;

  return existsSync(dbPath) ? dbPath : '';
}

export async function checkAppConfig(ctx: any, next: any): Promise<void> {
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
