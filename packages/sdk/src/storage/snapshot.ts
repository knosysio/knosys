import { existsSync, readdirSync, lstatSync, readFileSync } from 'fs';
import path from 'path';
import { identifier, contained, readJson, hash, jsonBytes, walk, isWithin, canonical } from './files';
import { readDocument, yamlObject, type Overlay } from './document';
import { fail, type AppRegistration, type Collection, type Snapshot, type Fields } from './contracts';

interface IdentityRecord { id: string; aliases: string[] }
export interface Identities { schemaVersion: 1; collections: Record<string, { id: string; records: Record<string, IdentityRecord> }> }
export function readSchema(source: string, registration: AppRegistration): string[] {
  let schema: unknown = registration.pathSchema;
  if (!schema) for (const file of ['.meta/entity.yml', '.meta/metadata.yml', '.meta/basic.yml']) {
    const full: string = contained(source, file);
    if (existsSync(full)) { schema = yamlObject(readFileSync(full, 'utf8')).path; break; }
  }
  const parts: string[] = String(schema || ':category/:collection/:slug').split('/');
  const offset: number = parts[0] === ':category' ? 1 : 0;
  if (parts[offset] !== ':collection' || parts.length <= offset + 1 || parts.some((part: string): boolean => !/^:[a-zA-Z][\w]*$/.test(part)) || new Set(parts).size !== parts.length) fail(409, 'INVALID_SCHEMA', 'Path schema requires optional category, collection and record parameters');
  return parts.map((part: string): string => part.slice(1));
}
function directories(root: string, depth: number, overlay: Overlay): string[] {
  const found: Set<string> = new Set();
  const visit = (relative: string, level: number): void => {
    if (level === depth) { found.add(relative); return; }
    const current: string = relative ? contained(root, relative) : root;
    if (!existsSync(current)) return;
    for (const name of readdirSync(current).sort()) {
      if (name.startsWith('.')) continue;
      const full: string = contained(root, relative ? relative + '/' + name : name);
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) fail(403, 'SYMLINK_UNSUPPORTED', 'Source symlinks require explicit migration');
      if (stat.isDirectory()) visit(relative ? relative + '/' + name : name, level + 1);
    }
  };
  visit('', 0);
  for (const [file, bytes] of overlay) { const parts: string[] = file.split('/'); if (bytes !== null && parts.length > depth) found.add(parts.slice(0, depth).join('/')); }
  return [...found].sort();
}
export function buildSnapshot(source: string, registration: AppRegistration, oldDb: Fields = {}, overlay: Overlay = new Map()): { snapshot: Snapshot; identities: Identities } {
  const schema: string[] = readSchema(source, registration);
  const collectionDepth: number = schema[0] === 'category' ? 2 : 1;
  if (!isWithin(source, canonical(path.join(source, '.knosys/record-identities.json')))) fail(403, 'PATH_ESCAPE', 'Identity table escapes source');
  const previous: Identities = readJson<Identities>(path.join(source, '.knosys/record-identities.json'), { schemaVersion: 1, collections: {} });
  if (previous.schemaVersion !== 1 || !previous.collections) fail(409, 'IDENTITY_CONFLICT', 'Invalid identity table');
  const identities: Identities = { schemaVersion: 1, collections: Object.assign(Object.create(null), JSON.parse(JSON.stringify(previous.collections))) };
  for (const collection of Object.values(identities.collections)) collection.records = Object.assign(Object.create(null), collection.records);
  const collectionIds: Set<string> = new Set();
  const collections: Collection[] = [];
  for (const relative of directories(source, collectionDepth, overlay)) {
    const oldCandidates: Fields[] = Object.values(oldDb).filter((value: unknown): value is Fields => Boolean(value && typeof value === 'object' && (value as Fields).path === relative));
    if (oldCandidates.length > 1) fail(409, 'IDENTITY_CONFLICT', 'Multiple indexes point to the same collection');
    const old: Fields = oldCandidates[0] || {};
    const saved = identities.collections[relative];
    if (saved && old.id && saved.id !== String(old.id)) fail(409, 'IDENTITY_CONFLICT', 'Collection identity contradicts the existing index');
    const id: string = saved?.id || (old.id !== undefined && old.id !== null ? String(old.id) : identifier('collection:' + relative));
    if (!id || collectionIds.has(id)) fail(409, 'IDENTITY_CONFLICT', 'Duplicate collection identity');
    collectionIds.add(id);
    const identity = saved || { id, records: Object.create(null) as Record<string, IdentityRecord> };
    identities.collections[relative] = identity;
    const recordIds: Set<string> = new Set();
    const collection: Collection = { id, path: relative, title: String(old.title || relative.split('/').pop()), parameters: schema.slice(collectionDepth), records: [] };
    const collectionRoot: string = contained(source, relative);
    for (const file of ['.meta/entity.yml', '.meta/metadata.yml', '.meta/basic.yml']) {
      const full: string = contained(source, relative + '/' + file);
      if (existsSync(full)) { const meta: Fields = yamlObject(readFileSync(full, 'utf8')); if (meta.title) collection.title = String(meta.title); if (meta.path) collection.parameters = String(meta.path).split('/').map((parameter: string): string => parameter.replace(/^:/, '')); break; }
    }
    if (new Set(collection.parameters).size !== collection.parameters.length || collection.parameters.some((parameter: string): boolean => !/^[a-zA-Z]\w*$/.test(parameter))) fail(409, 'INVALID_SCHEMA', 'Invalid record parameters');
    const recordPaths: string[] = directories(source, collectionDepth + collection.parameters.length, overlay).filter((recordPath: string): boolean => recordPath.startsWith(relative + '/'));
    for (const recordPath of recordPaths) {
      const local: string = recordPath.slice(relative.length + 1);
      const files: string[] = ['entity.yml', 'metadata.yml', 'basic.yml', 'readme.md'];
      if (!files.some((file: string): boolean => overlay.has(recordPath + '/' + file) ? overlay.get(recordPath + '/' + file) !== null : existsSync(contained(source, recordPath + '/' + file)))) continue;
      const legacy: Fields[] = Array.isArray(old.records) ? old.records.filter((record: Fields): boolean => record.path === local) : [];
      if (legacy.length > 1) fail(409, 'IDENTITY_CONFLICT', 'Multiple old records point to one entity');
      const savedRecord: IdentityRecord | undefined = identity.records[local];
      const oldId: string | undefined = legacy[0]?.id === undefined ? undefined : String(legacy[0].id);
      if (savedRecord && oldId && savedRecord.id !== oldId && !savedRecord.aliases.includes(oldId)) fail(409, 'IDENTITY_CONFLICT', 'Record identity contradicts the existing index');
      const recordId: string = savedRecord?.id || oldId || identifier('record:' + relative + '/' + local);
      if (!recordId || recordIds.has(recordId)) fail(409, 'IDENTITY_CONFLICT', 'Duplicate record identity');
      recordIds.add(recordId);
      const document = readDocument(source, recordPath, overlay);
      const business: unknown = document.fields.id;
      identity.records[local] = savedRecord || { id: recordId, aliases: [...new Set([oldId, business === undefined ? undefined : String(business)].filter((value): value is string => value !== undefined))] };
      collection.records.push({ id: recordId, path: local, fields: document.fields, content: document.content, revision: document.revision, attachments: document.attachments });
    }
    collections.push(collection);
  }
  const sourceFiles: string[] = walk(source).filter((file: string): boolean => !file.startsWith('.knosys/'));
  const hashes: Map<string, string> = new Map(sourceFiles.map((file: string): [string, string] => [file, hash(readFileSync(contained(source, file)))]));
  for (const [file, bytes] of overlay) { if (bytes === null) hashes.delete(file); else hashes.set(file, hash(bytes)); }
  return { snapshot: { collections, revision: hash(jsonBytes([...hashes].sort(([a], [b]): number => a.localeCompare(b)))) }, identities };
}
export function indexBytes(snapshot: Snapshot): Buffer { return jsonBytes(Object.fromEntries(snapshot.collections.map((collection: Collection): [string, unknown] => [collection.id, { ...collection, records: collection.records.map((record) => ({ ...record.fields, id: record.id, path: record.path, revision: record.revision })) }]))); }
