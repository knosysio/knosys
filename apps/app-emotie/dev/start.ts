import { context, type BuildContext } from 'esbuild';
import { fork, type ChildProcess } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createServer as createHttpServer } from 'node:http';
import { createServer, type ViteDevServer } from 'vite';
import { developmentConfig } from './vite.ts';
if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('扩展本地开发要求 Node.js 24');
const root: string = path.resolve(import.meta.dirname, '../../..');
const portValue: string = process.env.KNOSYS_DEV_PORT || '8010';
const apiValue: string = process.env.KNOSYS_DEV_API_PORT || '8011';
for (const value of [portValue, apiValue]) if (!/^[1-9]\d*$/.test(value) || Number(value) > 65535) throw new Error('开发端口必须是 1 到 65535 的整数');
const port: number = Number(portValue); const apiPort: number = Number(apiValue);
if (port === apiPort) throw new Error('页面与 API 端口不能相同');
const dataRoot: string = path.resolve(root, process.env.KNOSYS_DEV_ROOT || '.build/emotie-dev/data');
const buildRoot: string = path.join(root, '.build/emotie-dev/runtime');
mkdirSync(path.join(dataRoot, 'project'), { recursive: true }); mkdirSync(buildRoot, { recursive: true });
const httpServer = createHttpServer();
let child: ChildProcess | undefined;
let compiler: BuildContext | undefined;
let vite: ViteDevServer | undefined;
let stopping: boolean = false;
let closing: Promise<void> | undefined;
let generation: number = 0;
let lastBuild: string = '';
let queue: Promise<void> = Promise.resolve();
async function stopChild(): Promise<void> {
  const previous: ChildProcess | undefined = child; child = undefined;
  if (!previous || previous.exitCode !== null || previous.signalCode !== null) return;
  await new Promise<void>((resolve): void => {
    const deadline = setTimeout((): void => { previous.kill('SIGKILL'); }, 6000);
    previous.once('exit', (): void => { clearTimeout(deadline); resolve(); }); previous.kill('SIGTERM');
  });
}
async function restart(): Promise<void> {
  await stopChild(); if (stopping) return;
  generation += 1;
  const current: ChildProcess = fork(path.join(buildRoot, 'server.mjs'), [], { cwd: root, execArgv: [], env: { ...process.env, KNOSYS_DEV_PORT: String(port), KNOSYS_DEV_API_PORT: String(apiPort), KNOSYS_DEV_GENERATION: String(generation), KNOSYS_APPS_ROOT: path.join(dataRoot, 'registrations'), KNOSYS_ALLOWED_ROOTS: JSON.stringify([path.join(dataRoot, 'project')]) }, stdio: ['inherit', 'inherit', 'inherit', 'ipc'] });
  child = current;
  await new Promise<void>((resolve, reject): void => {
    const deadline = setTimeout((): void => reject(new Error('本地 API 启动超时')), 10000);
    const failed = (code: number | null): void => { clearTimeout(deadline); reject(new Error('本地 API 启动失败，退出码：' + code)); };
    current.once('error', (error): void => { clearTimeout(deadline); reject(error); }); current.once('exit', failed);
    current.on('message', (message: unknown): void => { if (message && typeof message === 'object' && 'type' in message && message.type === 'ready') { clearTimeout(deadline); current.removeListener('exit', failed); console.info('扩展 API 已就绪 · 第 ' + generation + ' 次加载'); resolve(); } });
  });
}
function close(): Promise<void> {
  if (closing) return closing;
  stopping = true; httpServer.closeAllConnections();
  closing = Promise.allSettled([compiler?.dispose(), vite?.close(), new Promise<void>((resolve): void => { httpServer.close((): void => resolve()); }), (async (): Promise<void> => { await queue.catch((): void => {}); await stopChild(); })()]).then((results): void => {
    for (const result of results) if (result.status === 'rejected') { console.error(result.reason); process.exitCode = 1; }
  });
  return closing;
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, (): void => { void close().catch((error): void => { console.error(error); process.exitCode = 1; }); });
try {
  vite = await createServer(developmentConfig(port, apiPort, httpServer));
  compiler = await context({ entryPoints: [path.join(import.meta.dirname, 'api.ts')], outfile: path.join(buildRoot, 'server.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node24', sourcemap: true, alias: { '@knosys/sdk/app': path.join(root, 'packages/sdk/src/app/index.ts') }, banner: { js: "import{createRequire as __createRequire}from'node:module';const require=__createRequire(import.meta.url);" }, plugins: [{ name: 'restart-extension-api', setup(builder): void { builder.onEnd(async (result): Promise<void> => {
    if (stopping) return;
    if (result.errors.length) { vite?.ws.send({ type: 'error', err: { message: result.errors.map((error): string => error.text).join('\n'), stack: '', plugin: 'knosys-development-api' } }); return; }
    const digest: string = createHash('sha256').update(readFileSync(path.join(buildRoot, 'server.mjs'))).digest('hex');
    if (digest === lastBuild && child?.exitCode === null && child.signalCode === null) return;
    queue = queue.catch((): void => {}).then(restart);
    await queue; lastBuild = digest; vite?.ws.send({ type: 'update', updates: [] });
  }); } }] });
  await compiler.rebuild();
  if (!stopping) {
  httpServer.on('request', vite.middlewares);
  await new Promise<void>((resolve, reject): void => { httpServer.once('error', reject); httpServer.listen(port, '127.0.0.1', (): void => { httpServer.removeListener('error', reject); resolve(); }); });
  await compiler.watch();
  console.info(`KnoSys 扩展本地开发：http://127.0.0.1:${port}/apps/knosys`);
  console.info('初始化项目根：' + path.relative(root, path.join(dataRoot, 'project')));
  console.info('前端热更新 · 后端自动重启 · Ctrl+C 停止');
  }
} catch (error) { if (!stopping) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; } await close(); }
