import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStorage, StorageError } from '../src/storage/index.ts';

function fixture(fault?: (stage: string) => void) {
  const root: string = mkdtempSync(path.join(tmpdir(), 'knosys-storage-'));
  const appsRoot: string = path.join(root, 'apps');
  const service = createStorage({ appsRoot, allowedRoots: [root], fault });
  return { root, appsRoot, service };
}
const isConflict = (error: unknown): boolean => error instanceof StorageError && error.status === 409;

test('create, original Markdown round trip, effective metadata, business ID and revision conflicts', async (): Promise<void> => {
  const { root, service } = fixture();
  await service.initialize({ mode: 'create', projectRoot: root, sourceRelative: 'data', appName: 'test' });
  const initial = await service.getSnapshot('test');
  assert.equal(initial.collections.length, 1);
  assert.equal(initial.collections[0].records.length, 0);
  const collection: string = initial.collections[0].id;
  const record = await service.createRecord('test', collection, { parameters: { slug: '中文' }, fields: { title: 'Example' }, content: '' });
  const entity: string = path.join(root, 'data/kb/notes/中文');
  const markdown: string = '---\r\nunknown: preserved\r\ntitle: Front title\r\n---\r\n# Heading\r\n\r\nBody\r\n';
  writeFileSync(path.join(entity, 'readme.md'), markdown);
  writeFileSync(path.join(entity, 'entity.yml'), 'id: business-id\nunknown: [one, two]\ntitle: Lower\n');
  writeFileSync(path.join(entity, 'attachment.bin'), Buffer.from([1, 2, 3]));
  writeFileSync(path.join(entity, '.custom'), 'hidden preserved');
  writeFileSync(path.join(entity, '100%.bin'), 'percent preserved');
  const before = await service.getDocument('test', collection, record.id);
  assert.equal(before.fields.title, 'Heading');
  assert.equal(before.fields.id, 'business-id');
  const bytes: Buffer = readFileSync(path.join(entity, 'entity.yml'));
  await service.updateRecord('test', collection, record.id, { expectedRevision: before.revision, content: before.content, fields: { title: 'Heading' } });
  assert.equal(readFileSync(path.join(entity, 'readme.md'), 'utf8'), markdown);
  assert.deepEqual(readFileSync(path.join(entity, 'entity.yml')), bytes);
  const updated = await service.updateRecord('test', collection, record.id, { expectedRevision: before.revision, content: before.content + 'Added\n', fields: { description: 'New' } });
  assert.ok(readFileSync(path.join(entity, 'readme.md'), 'utf8').startsWith('---\r\nunknown: preserved'));
  assert.equal(updated.fields.id, 'business-id');
  assert.equal(updated.id, record.id);
  assert.equal(updated.attachments.length, 2); assert.equal(readFileSync(path.join(entity, '.custom'), 'utf8'), 'hidden preserved');
  await assert.rejects(service.createRecord('test', collection, { parameters: { slug: '.meta' } }));
  await assert.rejects(service.updateRecord('test', collection, record.id, { expectedRevision: before.revision, content: 'stale' }), isConflict);
  await assert.rejects(service.deleteRecord('test', collection, record.id, before.revision), isConflict);
  await service.deleteRecord('test', collection, record.id, updated.revision);
  assert.equal((await service.getSnapshot('test')).collections[0].records.length, 0);
});

test('register leaves source byte-identical; path traversal and symlink escapes are rejected', async (): Promise<void> => {
  const { root, service } = fixture();
  mkdirSync(path.join(root, 'source/kb/notes/a'), { recursive: true });
  writeFileSync(path.join(root, 'source/kb/notes/a/basic.yml'), 'id: own\ntitle: Old\n');
  await service.initialize({ mode: 'register', projectRoot: root, sourceRelative: 'source', appName: 'registered' });
  assert.deepEqual(readdirSync(path.join(root, 'source')), ['kb']);
  await service.initialize({ mode: 'register', projectRoot: path.join(root, 'source'), sourceRelative: '.', appName: 'root-registration' });
  assert.equal(readFileSync(path.join(root, 'source/kb/notes/a/basic.yml'), 'utf8'), 'id: own\ntitle: Old\n');
  await assert.rejects(service.initialize({ mode: 'create', projectRoot: root, sourceRelative: '../escape', appName: 'bad' }));
  await assert.rejects(service.initialize({ mode: 'create', projectRoot: root, sourceRelative: 'source', appName: 'duplicate' }), isConflict);
  const outside: string = mkdtempSync(path.join(tmpdir(), 'knosys-outside-'));
  symlinkSync(outside, path.join(root, 'escape'));
  await assert.rejects(service.initialize({ mode: 'create', projectRoot: root, sourceRelative: 'escape/data', appName: 'escape' }));
});

for (const stage of ['prepared', 'committed', 'file:0', 'file:1', 'file:2', 'complete']) {
  test('transaction recovery after ' + stage, async (): Promise<void> => {
    let enabled: boolean = false;
    const { root, appsRoot, service } = fixture((current: string): void => { if (enabled && current === stage) throw new Error('injected'); });
    await service.initialize({ mode: 'create', projectRoot: root, sourceRelative: 'data', appName: 'test' });
    const collection: string = (await service.getSnapshot('test')).collections[0].id;
    const record = await service.createRecord('test', collection, { parameters: { slug: 'a' }, content: 'old' });
    enabled = true;
    await assert.rejects(service.updateRecord('test', collection, record.id, { expectedRevision: record.revision, content: 'new' }));
    const recovered = createStorage({ appsRoot, allowedRoots: [root] });
    const document = await recovered.getDocument('test', collection, record.id);
    assert.equal(document.content, stage === 'prepared' ? 'old' : 'new');
    assert.equal((await recovered.getSnapshot('test')).collections[0].records[0].revision, document.revision);
  });
}

test('two service instances and registrations share stable IDs and reject stale edits', async (): Promise<void> => {
  const { root, appsRoot, service } = fixture();
  await service.initialize({ mode: 'create', projectRoot: root, sourceRelative: 'data', appName: 'one' });
  await service.initialize({ mode: 'register', projectRoot: root, sourceRelative: 'data', appName: 'two' });
  const other = createStorage({ appsRoot, allowedRoots: [root] });
  const collection: string = (await service.getSnapshot('one')).collections[0].id;
  const record = await service.createRecord('one', collection, { parameters: { slug: 'a' }, content: 'original' });
  const results = await Promise.allSettled([service.updateRecord('one', collection, record.id, { expectedRevision: record.revision, content: 'first' }), other.updateRecord('two', collection, record.id, { expectedRevision: record.revision, content: 'second' })]);
  assert.equal(results.filter((result): boolean => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result): boolean => result.status === 'rejected').length, 1);
  assert.equal((await other.getSnapshot('two')).collections[0].records[0].id, record.id);
});

test('two independent processes serialize writes to the canonical shared source', async (): Promise<void> => {
  const { spawn } = await import('node:child_process');
  const { root, appsRoot, service } = fixture(); await service.initialize({ mode: 'create', projectRoot: root, sourceRelative: 'data', appName: 'test' });
  const collection: string = (await service.getSnapshot('test')).collections[0].id; const record = await service.createRecord('test', collection, { parameters: { slug: 'a' }, content: 'before' });
  const sdk: string = new URL('../dist/app/index.cjs', import.meta.url).pathname;
  const run = (content: string): Promise<number | null> => new Promise((resolve, reject): void => {
    const code: string = `const {createStorage}=require(${JSON.stringify(sdk)});createStorage(${JSON.stringify({ appsRoot, allowedRoots: [root] })}).updateRecord('test',${JSON.stringify(collection)},${JSON.stringify(record.id)},${JSON.stringify({ content, expectedRevision: record.revision })}).then(()=>process.exitCode=0).catch(error=>{process.exitCode=error.code==='REVISION_CONFLICT'?42:1;});`;
    const child = spawn(process.execPath, ['-e', code], { stdio: 'ignore' }); child.on('error', reject); child.on('exit', resolve);
  });
  assert.deepEqual((await Promise.all([run('one'), run('two')])).sort(), [0, 42]);
});

test('recovery through another apps root does not recreate an uninstalled registration', async (): Promise<void> => {
  const { rmSync } = await import('node:fs');
  let enabled: boolean = false;
  const { root, service, appsRoot } = fixture((stage: string): void => { if (enabled && stage === 'committed') throw new Error('crash'); });
  await service.initialize({ mode: 'create', projectRoot: root, sourceRelative: 'data', appName: 'first' });
  const collection: string = (await service.getSnapshot('first')).collections[0].id; const record = await service.createRecord('first', collection, { parameters: { slug: 'a' }, content: 'before' });
  const other = createStorage({ appsRoot: path.join(root, 'other-apps'), allowedRoots: [root] });
  await other.initialize({ mode: 'register', projectRoot: root, sourceRelative: 'data', appName: 'second' }); enabled = true;
  await assert.rejects(service.updateRecord('first', collection, record.id, { content: 'after', expectedRevision: record.revision }));
  rmSync(path.join(appsRoot, 'first'), { recursive: true });
  assert.equal((await other.getDocument('second', collection, record.id)).content, 'after');
  assert.equal(readdirSync(appsRoot).length, 0);
});

test('effective basic metadata, empty higher-priority files, multiple H1s and extension bytes remain consistent', async (): Promise<void> => {
  const { root, service } = fixture(); const entity: string = path.join(root, 'source/kb/notes/a'); mkdirSync(path.join(entity, 'extension'), { recursive: true });
  writeFileSync(path.join(entity, 'entity.yml'), ''); writeFileSync(path.join(entity, 'basic.yml'), 'id: own\ntitle: Lower\ndescription: Old\ncustom:\n  nested: kept\n');
  writeFileSync(path.join(entity, 'readme.md'), '---\nunknown: kept\ntags: []\n---\n# First\n\n# Last\n\nBody\n'); writeFileSync(path.join(entity, 'extension/data.yml'), 'raw: preserved\n');
  await service.initialize({ mode: 'register', projectRoot: root, sourceRelative: 'source', appName: 'test' }); const snapshot = await service.getSnapshot('test'); const collection: string = snapshot.collections[0].id; const record = snapshot.collections[0].records[0]; assert.equal(record.fields.title, 'Last');
  await service.updateRecord('test', collection, record.id, { fields: { title: 'Updated', description: 'New', tags: ['tag'] }, expectedRevision: record.revision });
  assert.equal(readFileSync(path.join(entity, 'entity.yml'), 'utf8'), ''); assert.ok(readFileSync(path.join(entity, 'basic.yml'), 'utf8').includes('description: New')); assert.ok(readFileSync(path.join(entity, 'basic.yml'), 'utf8').includes('nested: kept'));
  const markdown: string = readFileSync(path.join(entity, 'readme.md'), 'utf8'); assert.ok(markdown.includes('# First')); assert.ok(markdown.includes('# Updated')); assert.ok(markdown.includes('unknown: kept')); assert.equal(readFileSync(path.join(entity, 'extension/data.yml'), 'utf8'), 'raw: preserved\n');
});

for (const stage of ['prepared', 'committed', 'file:0', 'file:1', 'file:2', 'file:3', 'complete']) {
  test('new record recovery after ' + stage, async (): Promise<void> => {
    let enabled: boolean = false;
    const { root, appsRoot, service } = fixture((current: string): void => { if (enabled && current === stage) throw new Error('injected'); });
    await service.initialize({ mode: 'create', projectRoot: root, sourceRelative: 'data', appName: 'test' }); const collection: string = (await service.getSnapshot('test')).collections[0].id; enabled = true;
    await assert.rejects(service.createRecord('test', collection, { parameters: { slug: 'new' }, content: 'body' }));
    const recovered = createStorage({ appsRoot, allowedRoots: [root] }); const snapshot = await recovered.getSnapshot('test'); assert.equal(snapshot.collections[0].records.length, stage === 'prepared' ? 0 : 1);
    if (stage === 'prepared') await recovered.createRecord('test', collection, { parameters: { slug: 'new' }, content: 'retry' });
  });
}

test('Setext headings and fenced code use real Markdown ownership and leave source bytes untouched on no-op', async (): Promise<void> => {
  const { root, service } = fixture(); const entity: string = path.join(root, 'source/kb/notes/a'); mkdirSync(entity, { recursive: true });
  const original: string = '\uFEFF---\r\nunknown: kept\r\ntitle: Lower\r\n---\r\nSetext title\r\n============\r\n\r\n```sh\r\n# Code is not a title\r\n```\r\n';
  writeFileSync(path.join(entity, 'readme.md'), original); await service.initialize({ mode: 'register', projectRoot: root, sourceRelative: 'source', appName: 'test' });
  const snapshot = await service.getSnapshot('test'); const collection: string = snapshot.collections[0].id; const record = snapshot.collections[0].records[0]; assert.equal(record.fields.title, 'Setext title');
  await service.updateRecord('test', collection, record.id, { content: record.content, expectedRevision: record.revision }); assert.equal(readFileSync(path.join(entity, 'readme.md'), 'utf8'), original);
  const updated = await service.updateRecord('test', collection, record.id, { fields: { title: 'Changed title' }, expectedRevision: record.revision }); assert.equal(updated.fields.title, 'Changed title');
  const saved: string = readFileSync(path.join(entity, 'readme.md'), 'utf8'); assert.ok(saved.includes('# Code is not a title')); assert.ok(saved.startsWith('\uFEFF---\r\nunknown: kept')); assert.ok(saved.includes('============\r\n'));
});


test('legacy and unsupported writer registrations remain readable but cannot write', async (): Promise<void> => {
  const { root, appsRoot, service } = fixture();
  await service.initialize({ mode: 'create', projectRoot: root, sourceRelative: 'data', appName: 'test' });
  const snapshot = await service.getSnapshot('test'); const collection: string = snapshot.collections[0].id;
  const record = await service.createRecord('test', collection, { parameters: { slug: 'a' }, content: 'original' });
  const file: string = path.join(appsRoot, 'test/app.json'); const registration = JSON.parse(readFileSync(file, 'utf8'));
  for (const version of [undefined, '9.0.0']) {
    const altered = { ...registration, minimumWriterVersion: version }; writeFileSync(file, JSON.stringify(altered));
    assert.equal((await service.getSnapshot('test')).writable, false);
    assert.equal((await service.getDocument('test', collection, record.id)).writable, false);
    await assert.rejects(service.updateRecord('test', collection, record.id, { content: 'blocked', expectedRevision: record.revision }), isConflict);
    assert.equal((await service.getDocument('test', collection, record.id)).content, 'original');
    assert.notEqual((await service.listApps())[0].status, 'available');
  }
});
