import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
import { request as httpRequest } from 'node:http';

test('standalone HTTP lifecycle, origin boundaries, revisions and safe attachments', async (): Promise<void> => {
  const root: string = mkdtempSync(path.join(tmpdir(), 'knosys-http-')); const project: string = path.join(root, 'project'); mkdirSync(project);
  const probe = createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening'); const port: number = (probe.address() as { port: number }).port; await new Promise<void>((resolve): void => { probe.close((): void => resolve()); });
  const child = spawn(process.execPath, ['apps/app-web/dist/server.mjs'], { cwd: process.cwd(), env: { ...process.env, KNOSYS_PORT: String(port), KNOSYS_APPS_ROOT: path.join(root, 'apps'), KNOSYS_ALLOWED_ROOTS: JSON.stringify([project]) }, stdio: ['ignore', 'pipe', 'pipe'] });
  const base: string = 'http://127.0.0.1:' + port;
  try {
    await new Promise<void>((resolve, reject): void => { const timeout = setTimeout((): void => reject(new Error('server startup timed out')), 10000); child.stdout.on('data', (bytes: Buffer): void => { if (bytes.toString().includes('listening')) { clearTimeout(timeout); resolve(); } }); child.once('exit', (code): void => { clearTimeout(timeout); reject(new Error('server exited: ' + code)); }); });
    const call = async (route: string, method: string = 'GET', body?: unknown, headers: Record<string, string> = {}): Promise<Response> => fetch(base + '/api/knosys/v1' + route, { method, headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: base }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal(await new Promise<number>((resolve, reject): void => { const request = httpRequest(base + '/api/knosys/v1/apps', { headers: { Host: 'evil.example:' + port } }, (response): void => { response.resume(); resolve(response.statusCode || 0); }); request.on('error', reject); request.end(); }), 403);
    assert.equal((await call('/apps', 'GET', undefined, { Origin: 'https://evil.example' })).status, 403);
    assert.equal((await fetch(base + '/api/knosys/v1/initialize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
    assert.equal((await call('/initialize', 'POST', { mode: 'create', projectRoot: root, sourceRelative: 'bad', appName: 'bad' })).status, 403);
    const initialized = await call('/initialize', 'POST', { mode: 'create', projectRoot: project, sourceRelative: 'data', appName: 'test' }); assert.equal(initialized.status, 200, await initialized.text());
    const collections = await (await call('/collections?app=test')).json(); const collection: string = collections.data[0].id;
    assert.equal((await call('/records?app=test&collection=' + collection + '&pageSize=101')).status, 400);
    assert.equal((await call('/records?app=test&collection=' + collection + '&pageNum=1.2')).status, 400);
    const created = await (await call('/record?app=test&collection=' + collection, 'POST', { parameters: { slug: '中文' }, fields: { title: 'Title' }, content: 'original' })).json(); assert.equal(created.success, true);
    const record: string = created.data.id; const query: string = '?app=test&collection=' + collection + '&record=' + record;
    const updated = await call('/record' + query, 'PUT', { content: 'updated', expectedRevision: created.data.revision }); assert.equal(updated.status, 200);
    const legacy = await (await fetch(base + '/api/knosys/apps/test/' + record)).json(); assert.equal(legacy.data.data.content, 'updated');
    const legacyWrite = await fetch(base + '/api/knosys/apps/test/' + record, { method: 'PUT', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: { title: 'Legacy updated', id: record, path: 'legacy/display' } }) }); assert.equal(legacyWrite.status, 200);
    assert.equal((await call('/record' + query, 'PUT', { content: 'stale', expectedRevision: created.data.revision })).status, 409);
    assert.equal((await call('/record' + query, 'DELETE', { expectedRevision: created.data.revision })).status, 409);
    const entity: string = path.join(project, 'data/kb/notes/中文'); writeFileSync(path.join(entity, 'active.svg'), '<svg onload="alert(1)"/>'); writeFileSync(path.join(entity, 'image.png'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const document = await (await call('/document' + query)).json();
    for (const attachment of document.data.attachments) {
      const response: Response = await call('/attachment' + query + '&attachment=' + attachment.id);
      assert.equal(response.status, 200); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(response.headers.get('content-disposition')?.startsWith(attachment.name === 'image.png' ? 'inline' : 'attachment'));
    }
    assert.equal((await call('/attachment' + query + '&attachment=../../secret')).status, 404);
    assert.equal((await call('/configuration?app=test', 'PUT', { changes: { source: '/tmp/escape' }, expectedRevision: 'bad' })).status, 400);
    assert.equal((await call('/collections?app=..%2Fescape')).status, 400);
    assert.equal((await call('/record' + query, 'DELETE', { expectedRevision: document.data.revision })).status, 200);
    assert.equal((await call('/record' + query)).status, 404);
    assert.equal((await fetch(base + '/editor?app=test')).status, 200);
    assert.equal((await fetch(base + '/api/unknown')).status, 404);
  } finally { child.kill('SIGTERM'); await once(child, 'exit'); }
});
