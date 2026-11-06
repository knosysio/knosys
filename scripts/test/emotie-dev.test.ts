import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';
const delay = (ms: number): Promise<void> => new Promise((resolve): void => { setTimeout(resolve, ms); });
async function unusedPort(): Promise<number> {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port: number = (server.address() as { port: number }).port;
  await new Promise<void>((resolve): void => { server.close((): void => resolve()); }); return port;
}
async function until<T>(read: () => Promise<T>, accepts: (value: T) => boolean): Promise<T> {
  const deadline: number = Date.now() + 20000;
  while (Date.now() < deadline) { try { const value: T = await read(); if (accepts(value)) return value; } catch {} await delay(100); }
  throw new Error('Development server condition timed out');
}
test('source-only local extension works without adjacent host, reloads its SDK, recovers build errors and releases ports', { timeout: 90000 }, async (): Promise<void> => {
  const repository: string = process.cwd(); const fixture: string = mkdtempSync(path.join(tmpdir(), 'knosys-dev-fixture-'));
  const files: string[] = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const name of files) { const source: string = path.join(repository, name); if (!existsSync(source)) continue; const destination: string = path.join(fixture, name); mkdirSync(path.dirname(destination), { recursive: true }); copyFileSync(source, destination); }
  let output: string = ''; const port: number = await unusedPort(); let apiPort: number = await unusedPort(); while (apiPort === port) apiPort = await unusedPort();
  const base: string = 'http://127.0.0.1:' + port;
  let child: ReturnType<typeof spawn> | undefined;
  try {
    execFileSync(process.execPath, ['scripts/restore-artifacts.ts', '--from', path.join(repository, '.build/artifacts')], { cwd: fixture, stdio: 'pipe' });
    execFileSync('pnpm', ['install', '--offline', '--frozen-lockfile'], { cwd: fixture, stdio: 'pipe' });
    assert.equal(existsSync(path.join(fixture, 'packages/sdk/dist')), false);
    child = spawn(process.execPath, ['apps/app-emotie/dev/start.ts'], { cwd: fixture, env: { ...process.env, KNOSYS_DEV_PORT: String(port), KNOSYS_DEV_API_PORT: String(apiPort) }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout!.on('data', (data: Buffer): void => { output += data; }); child.stderr!.on('data', (data: Buffer): void => { output += data; });
    const status = (): Promise<{ generation: string; pid: number }> => fetch(base + '/__knosys_dev/status').then((response): Promise<{ generation: string; pid: number }> => response.json());
    const initial = await until(status, (value): boolean => Boolean(value.pid));
    assert.match(await (await fetch(base + '/apps/knosys/editor')).text(), /main\.tsx/);
    const call = (route: string, method: string = 'GET', body?: unknown, role: string = 'administrator'): Promise<Response> => fetch(base + '/api/knosys/v1' + route, { method, headers: { Origin: base, 'Content-Type': 'application/json', 'X-Knosys-Dev-Role': role }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal((await call('/apps', 'GET', undefined, 'anonymous')).status, 401);
    assert.equal((await call('/settings', 'GET', undefined, 'reader')).status, 403);
    assert.equal((await call('/apps', 'GET', undefined, 'reader')).status, 200);
    assert.equal((await fetch(base + '/api/knosys/v1/initialize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await call('/apps', 'GET', undefined, 'invalid')).status, 400);
    assert.equal(await new Promise<number>((resolve, reject): void => { const request = httpRequest('http://127.0.0.1:' + apiPort + '/api/knosys/v1/apps', { headers: { Host: 'evil.example' } }, (response): void => { response.resume(); resolve(response.statusCode || 0); }); request.on('error', reject); request.end(); }), 403);
    assert.equal((await call('/initialize', 'POST', { mode: 'create', appName: 'bad', projectRoot: fixture, sourceRelative: 'data' })).status, 403);
    const initialized: Response = await call('/initialize', 'POST', { mode: 'create', appName: 'test', projectRoot: path.join(fixture, '.build/emotie-dev/data/project'), sourceRelative: 'data' }); assert.equal(initialized.status, 200, await initialized.text());
    assert.equal((await fetch(base + '/@fs' + path.join(fixture, '.build/emotie-dev/data/registrations/test/app.json'))).status, 403);
    const collections = await (await call('/collections?app=test')).json(); const collection: string = collections.data[0].id;
    const record = await (await call('/record?app=test&collection=' + collection, 'POST', { parameters: { slug: 'test' }, content: 'persistent source', fields: { title: 'Local fixture' } })).json(); assert.equal(record.success, true);
    const sdk: string = path.join(fixture, 'packages/sdk/src/storage/index.ts'); const original: string = readFileSync(sdk, 'utf8');
    writeFileSync(sdk, original.replace('Project root is not authorized by startup configuration', 'SDK watch confirmed'));
    const reloaded = await until(status, (value): boolean => value.pid !== initial.pid);
    const changed: Response = await call('/initialize', 'POST', { mode: 'create', appName: 'bad', projectRoot: fixture, sourceRelative: 'data' }); assert.equal((await changed.json()).message, 'SDK watch confirmed');
    assert.equal((await (await call('/document?app=test&collection=' + collection + '&record=' + record.data.id)).json()).data.content, 'persistent source');
    writeFileSync(sdk, original + '\ninvalid syntax !!!');
    await until(async (): Promise<boolean> => output.includes('Expected') || output.includes('error'), Boolean);
    assert.equal((await status()).pid, reloaded.pid);
    writeFileSync(sdk, original);
    await until(status, (value): boolean => value.pid !== reloaded.pid);
    const exit = once(child, 'exit'); child.kill('SIGINT'); const [code] = await exit; assert.equal(code, 0);
    for (const target of [port, apiPort]) await until(async (): Promise<boolean> => { try { await fetch('http://127.0.0.1:' + target); return false; } catch { return true; } }, Boolean);
    console.info('PASS isolated source-only bootstrap, roles, CRUD, SDK reload, build recovery and shutdown');
  } catch (error) { console.error(output.split(fixture).join('${FIXTURE_ROOT}')); throw error; }
  finally { if (child && child.exitCode === null && child.signalCode === null) { const exit = once(child, 'exit'); child.kill('SIGTERM'); await exit; } rmSync(fixture, { recursive: true, force: true }); }
});
