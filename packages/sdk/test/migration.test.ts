import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { planMigration, applyMigration, verifyMigration, type MigrationMapping } from '../src/storage/migration.ts';
function fixture(): { root: string; input: string; target: string } { const root: string = mkdtempSync(path.join(tmpdir(), 'knosys-migrate-')); const input: string = path.join(root, 'legacy'); mkdirSync(path.join(input, 'app'), { recursive: true }); return { root, input, target: path.join(root, 'migrated') }; }
function json(file: string, value: unknown): void { writeFileSync(file, JSON.stringify(value)); }

test('JSON migration requires mapping, preserves business ID and attachments and verifies actual target hashes', async (): Promise<void> => {
  const { input, target } = fixture();
  json(path.join(input, 'app/app.json'), { name: 'app' });
  const record: string = path.join(input, 'app/knosys/旧集合/中文'); mkdirSync(record, { recursive: true });
  json(path.join(record, 'index.json'), { id: 'business', title: '中文', content: '# 正文\n', custom: { nested: true } }); writeFileSync(path.join(record, 'a.bin'), Buffer.from([9, 8, 7]));
  const blocked = await planMigration(input, target); assert.ok(blocked.blockers.length);
  await assert.rejects(applyMigration(blocked)); assert.equal(existsSync(target), false);
  const mapping: MigrationMapping[] = [{ app: 'app', collectionKey: 'notes', legacyId: 'business', collectionPath: 'kb/notes', recordPath: '中文', systemId: 'system-id' }];
  const plan = await planMigration(input, target, mapping); assert.deepEqual(plan.blockers, []);
  const report = await applyMigration(plan); assert.equal(report.status, 'complete'); assert.deepEqual(verifyMigration(report), { verified: true, applications: 1, records: 1 });
  assert.ok(readFileSync(path.join(target, 'data/app/kb/notes/中文/entity.yml'), 'utf8').includes('id: business'));
  assert.deepEqual(readFileSync(path.join(target, 'data/app/kb/notes/中文/a.bin')), Buffer.from([9, 8, 7]));
  await assert.rejects(applyMigration(plan));
  writeFileSync(path.join(target, 'data/app/kb/notes/中文/readme.md'), 'changed'); assert.throws((): void => { verifyMigration(report); });
});

test('pure QiiDB keeps its external source unchanged and preserves existing index identity', async (): Promise<void> => {
  const { root, input, target } = fixture(); const source: string = path.join(root, 'source'); mkdirSync(path.join(source, 'kb/notes/a'), { recursive: true });
  writeFileSync(path.join(source, 'kb/notes/a/basic.yml'), 'id: business\ntitle: A\n'); writeFileSync(path.join(source, 'kb/notes/a/readme.md'), 'body\n');
  json(path.join(input, 'app/app.json'), { name: 'app', source }); json(path.join(input, 'app/db.json'), { notes: { id: 'collection', path: 'kb/notes', records: [{ id: 'old-record', path: 'a', title: 'A' }] } });
  const plan = await planMigration(input, target); assert.deepEqual(plan.blockers, []); const report = await applyMigration(plan); assert.equal(report.apps[0].kind, 'qiidb');
  assert.equal(JSON.parse(readFileSync(path.join(target, 'apps/app/app.json'), 'utf8')).source, realpathSync(source));
  assert.equal(existsSync(path.join(source, '.knosys')), false); assert.equal(verifyMigration(report).records, 1);
});

test('input additions and overlapping targets are rejected before publication', async (): Promise<void> => {
  const { input, target } = fixture(); json(path.join(input, 'app/app.json'), { name: 'app' });
  const plan = await planMigration(input, target); writeFileSync(path.join(input, 'added.txt'), 'change'); await assert.rejects(applyMigration(plan)); assert.equal(existsSync(target), false);
  await assert.rejects(planMigration(input, path.join(input, 'output')));
  await assert.rejects(planMigration(input, path.dirname(input)));
});

test('mixed source conflict requires explicit field selection and preserves unknown front matter', async (): Promise<void> => {
  const { root, input, target } = fixture(); const source: string = path.join(root, 'source'); const entity: string = path.join(source, 'kb/notes/a'); mkdirSync(entity, { recursive: true });
  writeFileSync(path.join(entity, 'entity.yml'), 'id: business\ntitle: A\n'); writeFileSync(path.join(entity, 'readme.md'), '---\nunknown: untouched\n---\n# A\nbody\n');
  json(path.join(input, 'app/app.json'), { name: 'app', source });
  const record: string = path.join(input, 'app/knosys/one'); mkdirSync(record, { recursive: true }); json(path.join(record, 'index.json'), { id: 'business', title: 'B' }); writeFileSync(path.join(record, 'new.txt'), 'JSON attachment');
  const mapping: MigrationMapping[] = [{ app: 'app', collectionKey: 'notes', legacyId: 'business', collectionPath: 'kb/notes', recordPath: 'a' }];
  assert.ok((await planMigration(input, target, mapping)).blockers.length);
  const plan = await planMigration(input, target, [{ ...mapping[0], fieldSources: { title: 'json' } }]); assert.deepEqual(plan.blockers, []);
  const report = await applyMigration(plan); assert.equal(verifyMigration(report).records, 1);
  assert.ok(readFileSync(path.join(target, 'data/app/kb/notes/a/readme.md'), 'utf8').includes('unknown: untouched'));
  assert.ok(readFileSync(path.join(target, 'data/app/kb/notes/a/readme.md'), 'utf8').includes('# B'));
  assert.ok(readFileSync(path.join(entity, 'readme.md'), 'utf8').includes('# A')); assert.equal(readFileSync(path.join(target, 'data/app/kb/notes/a/new.txt'), 'utf8'), 'JSON attachment');
});

test('a source pointer to JSON still requires conversion and never becomes an empty QiiDB registration', async (): Promise<void> => {
  const { root, input, target } = fixture(); const source: string = path.join(root, 'json-source'); mkdirSync(path.join(source, '旧/实体'), { recursive: true });
  json(path.join(source, '旧/实体/index.json'), { id: 'old', title: 'Title', path: 'business-path', custom: 'kept', content: 'body' });
  json(path.join(input, 'app/app.json'), { name: 'app', source });
  const { createStorage } = await import('../src/storage/index.ts'); const service = createStorage({ appsRoot: path.join(root, 'registrations'), allowedRoots: [root] });
  await assert.rejects(service.initialize({ mode: 'register', projectRoot: root, sourceRelative: 'json-source', appName: 'empty' }));
  const plan = await planMigration(input, target, [{ app: 'app', collectionKey: 'notes', legacyId: 'old', collectionPath: 'notes', recordPath: 'a' }]); assert.deepEqual(plan.blockers, []); assert.equal(plan.apps[0].kind, 'json');
  const report = await applyMigration(plan); assert.equal(verifyMigration(report).records, 1); assert.ok(readFileSync(path.join(target, 'data/app/notes/a/entity.yml'), 'utf8').includes('path: business-path'));
  assert.equal(existsSync(path.join(target, 'data/app/旧/实体/index.json')), false);
});
