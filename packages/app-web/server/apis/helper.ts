import { readData } from '@knosys/sdk';

export function getAppDataPath(ctx: any): string {
  return `${ctx.state.KNOSYS_APP_PATH}/app.json`;
}

export function getDataSourcePath(ctx: any): string {
  return (readData(getAppDataPath(ctx)) as any)?.source || '';
}
