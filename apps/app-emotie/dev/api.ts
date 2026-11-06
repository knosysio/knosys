import Koa from 'koa';
import Router from '@koa/router';
import { bodyParser } from '@koa/bodyparser';
import { createServerExtension } from '../src/server';
const port: number = Number(process.env.KNOSYS_DEV_API_PORT);
const webPort: number = Number(process.env.KNOSYS_DEV_PORT);
const app: Koa = new Koa();
app.proxy = false;
app.use(async (ctx, next): Promise<void> => {
  const hosts: string[] = [`127.0.0.1:${port}`, `localhost:${port}`, `127.0.0.1:${webPort}`, `localhost:${webPort}`];
  const origin: string = ctx.get('origin');
  const origins: string[] = [`http://127.0.0.1:${webPort}`, `http://localhost:${webPort}`];
  if (!hosts.includes(ctx.get('host')) || (origin && !origins.includes(origin)) || (!['GET', 'HEAD', 'OPTIONS'].includes(ctx.method) && (!origin || !ctx.is('application/json')))) {
    ctx.status = 403; ctx.body = { success: false, code: 'LOCAL_ORIGIN_REQUIRED', message: '本地开发接口要求回环地址和同源 JSON 请求' }; return;
  }
  ctx.set('X-Content-Type-Options', 'nosniff');
  try { await next(); } catch (error) { const status: number = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 503; ctx.status = status >= 400 && status <= 599 ? status : 503; ctx.body = { success: false, code: ctx.status === 400 ? 'INVALID_BODY' : 'DEVELOPMENT_API_ERROR', message: ctx.status === 400 ? 'JSON 请求格式错误' : '本地开发接口暂不可用' }; }
});
app.use(bodyParser({ enableTypes: ['json'], jsonLimit: '2mb', parsedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'] }));
const controller = new AbortController();
const extension = await createServerExtension({ paths: { apiDirectory: process.cwd(), repositoryDirectory: process.cwd() }, signal: controller.signal, logger: console });
const router: Router = new Router();
router.get('/__knosys_dev/status', (ctx): void => { ctx.body = { success: true, generation: process.env.KNOSYS_DEV_GENERATION, pid: process.pid }; });
for (const route of extension.routes) {
  if (!['session', 'administrator'].includes(route.access)) throw new Error('本地调试壳尚不支持此路由的访问策略：' + route.access);
  const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options';
  router[method](route.path, async (ctx, next): Promise<void> => {
    const role: string = ctx.get('x-knosys-dev-role') || 'administrator';
    if (!['administrator', 'reader', 'anonymous'].includes(role)) { ctx.status = 400; ctx.body = { success: false, code: 'INVALID_DEVELOPMENT_ROLE', message: '开发身份无效' }; return; }
    if (role === 'anonymous') { ctx.status = 401; ctx.body = { success: false, code: 'UNAUTHENTICATED', message: '当前开发身份为未登录' }; return; }
    if (route.access === 'administrator' && role !== 'administrator') { ctx.status = 403; ctx.body = { success: false, code: 'FORBIDDEN', message: '此操作需要管理员身份' }; return; }
    ctx.state.persona = { administrator: role === 'administrator' };
    ctx.state.applicationAccess = { protocolVersion: 1, allApplications: true, applicationIds: [] };
    await next();
  }, ...(route.middleware || []));
}
app.use(router.routes()); app.use(router.allowedMethods());
app.use((ctx): void => { ctx.status = 404; ctx.body = { success: false, code: 'NOT_FOUND', message: '接口不存在' }; });
await extension.start?.();
const server = app.listen(port, '127.0.0.1', (): void => { process.send?.({ type: 'ready' }); });
server.on('error', (error: Error): void => { console.error(error.message); process.exitCode = 1; });
let stopping: boolean = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async (): Promise<void> => {
  if (stopping) return; stopping = true;
  controller.abort(); const deadline = setTimeout((): void => server.closeAllConnections(), 5000);
  await new Promise<void>((resolve): void => { server.close((): void => resolve()); }); clearTimeout(deadline);
  await extension.stop?.(); process.disconnect?.();
});
