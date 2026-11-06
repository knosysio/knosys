import Koa from 'koa';
import { bodyParser } from '@koa/bodyparser';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { createKnosysRouter } from '@knosys/web-core/server';
import { fileURLToPath } from 'node:url';

if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('KnoSys Web requires Node.js 24');
const host: string = process.env.KNOSYS_HOST || '127.0.0.1';
if (!['127.0.0.1', '::1'].includes(host)) throw new Error('KnoSys Web only supports loopback listening');
const rawPort: string = process.env.KNOSYS_PORT || '8001';
if (!/^[1-9]\d*$/.test(rawPort) || Number(rawPort) > 65535) throw new Error('Invalid KNOSYS_PORT');
const port: number = Number(rawPort);
const appsRoot: string = path.resolve(process.env.KNOSYS_APPS_ROOT || path.join(homedir(), '.knosys/apps'));
const roots: unknown = process.env.KNOSYS_ALLOWED_ROOTS !== undefined ? JSON.parse(process.env.KNOSYS_ALLOWED_ROOTS) : [appsRoot, process.cwd()];
if (!Array.isArray(roots) || !roots.every((root: unknown): boolean => typeof root === 'string' && path.isAbsolute(root))) throw new Error('KNOSYS_ALLOWED_ROOTS must be an array of absolute paths');
const developmentOrigin: string | undefined = process.env.KNOSYS_VITE_ORIGIN;
if (developmentOrigin && !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):[1-9]\d*$/.test(developmentOrigin)) throw new Error('Invalid loopback Vite origin');
const webRoot: string = fileURLToPath(new URL('./', import.meta.url));
const app: Koa = new Koa();
app.proxy = false;
app.use(async (ctx, next): Promise<void> => {
  const allowedHosts: string[] = [host === '::1' ? `[::1]:${port}` : `${host}:${port}`, `localhost:${port}`];
  const authority: string = ctx.get('host'); const origin: string = ctx.get('origin');
  const currentOrigin: string = 'http://' + authority;
  const allowedOrigin: boolean = origin === currentOrigin || Boolean(developmentOrigin && origin === developmentOrigin);
  if (!allowedHosts.includes(authority) || (origin && !allowedOrigin) || (!['GET', 'HEAD', 'OPTIONS'].includes(ctx.method) && (!origin || !allowedOrigin || !ctx.is('application/json')))) {
    ctx.status = 403; ctx.body = { success: false, code: 'LOCAL_ORIGIN_REQUIRED', message: 'A loopback Host and same-origin JSON request are required' }; return;
  }
  ctx.set('X-Content-Type-Options', 'nosniff');
  try { await next(); } catch (error) { const status: number = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 503; ctx.status = status >= 400 && status <= 599 ? status : 503; ctx.body = { success: false, code: ctx.status === 400 ? 'INVALID_BODY' : 'SOURCE_UNAVAILABLE', message: ctx.status === 400 ? 'Invalid JSON request' : 'Source unavailable' }; }
});
app.use(bodyParser({ jsonLimit: '2mb', enableTypes: ['json'], parsedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'], onError: (_error, ctx): void => { ctx.throw(400, 'Invalid JSON body'); } }));
const router = createKnosysRouter({ appsRoot, allowedRoots: roots as string[], managedRoots: [path.join(homedir(), '.emotie/apps'), path.join(homedir(), '.emotie/cache'), path.join(process.cwd(), '.emotie/cache/apps')], authorize: async (): Promise<boolean> => true, isAdministrator: (): boolean => true });
app.use(router.routes()); app.use(router.allowedMethods());
app.use(async (ctx): Promise<void> => {
  if (ctx.method !== 'GET' || ctx.path.startsWith('/api/')) { ctx.status = 404; ctx.body = { success: false, code: 'NOT_FOUND', message: 'Not found' }; return; }
  let relative: string;
  try { relative = decodeURIComponent(ctx.path).replace(/^\/+/, ''); } catch { ctx.status = 400; return; }
  if (relative.includes('\0') || relative.split('/').some((part: string): boolean => part === '..' || part.startsWith('.'))) { ctx.status = 403; return; }
  const candidate: string = path.resolve(webRoot, relative || 'index.html');
  const selected: string = existsSync(candidate) && statSync(candidate).isFile() && (relative.startsWith('assets/') || relative === 'index.html') ? candidate : path.join(webRoot, 'index.html');
  if (!realpathSync(selected).startsWith(realpathSync(webRoot) + path.sep)) { ctx.status = 403; return; }
  ctx.type = path.extname(selected); ctx.body = readFileSync(selected);
});
const server = app.listen(port, host, (): void => console.info(`KnoSys listening at http://${host === '::1' ? '[::1]' : host}:${port}`));
server.on('error', (error: Error): void => { console.error(error.message); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, (): void => { server.close(); });
