import { existsSync, lstatSync, readFileSync, readdirSync, mkdirSync, readlinkSync, renameSync } from 'fs';
import path from 'path';
import { homedir } from 'os';
import yaml from 'js-yaml';
const { safeDump } = yaml;
import { canonical, hash, isWithin, readJson, jsonBytes, identifier, contained, atomicWrite, segments, walk } from './files';
import { buildSnapshot, indexBytes, readSchema, type Identities } from './snapshot';
import { withLock } from './lock';
import { readDocument, yamlObject } from './document';
import { fail, type Fields, type AppRegistration, type Collection, type RecordProjection } from './contracts';

export interface InventoryEntry { path: string; type: 'file' | 'directory' | 'symlink'; sha256?: string; realpath: string; link?: string }
export interface MigrationMapping { app: string; collectionKey: string; legacyId: string; collectionPath: string; recordPath: string; systemId?: string; fieldSources?: Record<string, 'source' | 'json' | 'index'>; acceptIndexOnly?: boolean }
export interface MigrationRecord { collectionPath: string; recordPath: string; collectionId: string; id: string; fields: Fields; content: string; aliases: string[]; oldUrls: string[]; files: { source: string; relative: string; sha256: string }[]; sourceKind: 'source' | 'json' | 'index-only' }
export interface MigrationApp { name: string; registration: AppRegistration; kind: 'qiidb' | 'json' | 'mixed'; records: MigrationRecord[]; source?: string; collections: { id: string; path: string; title: string; parameters?: string[] }[] }
export interface MigrationPlan { schemaVersion: 1; input: string; target: string; inventories: { root: string; entries: InventoryEntry[] }[]; apps: MigrationApp[]; blockers: string[]; minimumWriterVersion: string }
export interface MigrationReport { schemaVersion: 1; status: 'incomplete' | 'complete'; target: string; inputs: MigrationPlan['inventories']; apps: MigrationApp[]; outputs: InventoryEntry[]; error?: string }
function inventory(root: string): InventoryEntry[] {
  const entries: InventoryEntry[] = [];
  const visit = (relative: string): void => {
    const full: string = path.join(root, relative);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) { entries.push({ path: relative, type: 'symlink', realpath: canonical(full), link: readlinkSync(full) }); return; }
    if (stat.isDirectory()) { entries.push({ path: relative, type: 'directory', realpath: canonical(full) }); for (const name of readdirSync(full).sort()) visit(relative ? relative + '/' + name : name); return; }
    if (!stat.isFile()) fail(409, 'UNSUPPORTED_INPUT', 'Migration input contains a special file');
    entries.push({ path: relative, type: 'file', sha256: hash(readFileSync(full)), realpath: canonical(full) });
  };
  visit(''); return entries;
}
function assertTarget(target: string, roots: string[]): void {
  if (existsSync(target)) fail(409, 'TARGET_EXISTS', 'Migration target must not exist; retries require a new target');
  const managed: string[] = [path.join(homedir(), '.emotie/apps'), path.join(homedir(), '.emotie/cache')].map(canonical);
  if ([...roots, ...managed].some((root: string): boolean => isWithin(root, target) || isWithin(target, root))) fail(409, 'TARGET_OVERLAP', 'Migration target overlaps input or host-managed storage');
}
export async function planMigration(inputRoot: string, targetRoot: string, mapping: MigrationMapping[] = []): Promise<MigrationPlan> {
  const input: string = canonical(inputRoot);
  const directories: string[] = existsSync(path.join(input, 'app.json')) ? [input] : readdirSync(input).filter((name: string): boolean => !name.startsWith('.') && existsSync(path.join(input, name, 'app.json'))).map((name: string): string => contained(input, name));
  const sources: Set<string> = new Set();
  for (const directory of directories) { const registration = readJson<AppRegistration>(path.join(directory, 'app.json')); if (registration.source) sources.add(canonical(path.isAbsolute(registration.source) ? registration.source : path.resolve(directory, registration.source))); }
  const locks: string[] = [...new Set([...sources].sort().concat(input))];
  const run = (index: number): Promise<MigrationPlan> => index < locks.length ? withLock(locks[index], (): Promise<MigrationPlan> => run(index + 1)) : planMigrationSnapshot(input, targetRoot, mapping, sources);
  return run(0);
}
async function planMigrationSnapshot(inputRoot: string, targetRoot: string, mapping: MigrationMapping[], authorizedSources: Set<string>): Promise<MigrationPlan> {
  const input: string = canonical(inputRoot); const target: string = canonical(targetRoot);
  const appDirectories: string[] = existsSync(path.join(input, 'app.json')) ? [input] : readdirSync(input).filter((name: string): boolean => !name.startsWith('.') && existsSync(path.join(input, name, 'app.json'))).map((name: string): string => contained(input, name));
  if (!appDirectories.length) fail(400, 'NO_APPLICATIONS', 'No application registrations were found');
  const roots: Set<string> = new Set([input]);
  const initial: Map<string, InventoryEntry[]> = new Map([[input, inventory(input)]]);
  const plan: MigrationPlan = { schemaVersion: 1, input, target, inventories: [], apps: [], blockers: [], minimumWriterVersion: '0.1.0' };
  const names: Set<string> = new Set();
  for (const directory of appDirectories) {
    const registration: AppRegistration = readJson<AppRegistration>(path.join(directory, 'app.json'));
    const name: string = registration.name || path.basename(directory);
    if (segments(name).length !== 1 || names.has(name)) fail(409, 'APP_CONFLICT', 'Application names must be unique'); names.add(name);
    const db: Fields = readJson<Fields>(path.join(directory, 'db.json'), {});
    const source: string | undefined = registration.source ? canonical(path.isAbsolute(registration.source) ? registration.source : path.resolve(directory, registration.source)) : undefined;
    if (source) { if (!authorizedSources.has(source)) fail(409, 'INPUT_CHANGED', 'Application source binding changed while acquiring migration locks'); roots.add(source); if (!initial.has(source) && existsSync(source)) initial.set(source, inventory(source)); }
    const jsonRoot: string = path.join(directory, 'knosys');
    const jsonRecords: string[] = existsSync(jsonRoot) ? walk(jsonRoot, true).filter((file: string): boolean => file.endsWith('/index.json') || file === 'index.json') : [];
    const app: MigrationApp = { name, registration: { ...registration, name }, kind: source && existsSync(source) ? jsonRecords.length ? 'mixed' : 'qiidb' : 'json', records: [], collections: [], ...(source ? { source } : {}) };
    if (source && !existsSync(source)) plan.blockers.push(name + ': source is unavailable');
    const additionalJson: string[] = [];
    const qiiRecords: Map<string, MigrationRecord> = new Map();
    if (source && existsSync(source)) {
      try {
        const snapshot = buildSnapshot(source, { ...registration, source }, db).snapshot;
        const sourceJson: string[] = walk(source, true).filter((file: string): boolean => file === 'index.json' || file.endsWith('/index.json'));
        if (!snapshot.collections.some((collection: Collection): boolean => collection.records.length > 0) && sourceJson.length) { app.kind = 'json'; additionalJson.push(...sourceJson.map((file: string): string => contained(source, file))); }
        app.collections = app.kind === 'json' ? [] : snapshot.collections.map((collection: Collection) => ({ id: collection.id, path: collection.path, title: collection.title, parameters: collection.parameters }));
        for (const collection of snapshot.collections) for (const record of collection.records) {
          const relative: string = collection.path + '/' + record.path;
          const document = readDocument(source, relative);
          const row: MigrationRecord = { collectionPath: collection.path, recordPath: record.path, collectionId: collection.id, id: record.id, fields: record.fields, content: record.content, aliases: [...new Set([record.id, record.fields.id === undefined ? '' : String(record.fields.id)].filter(Boolean))], oldUrls: ['/apps/knosys/' + encodeURIComponent(name) + '/' + relative], files: document.files.map((file: string) => ({ source: contained(source, file), relative: file.slice(relative.length + 1), sha256: hash(document.values.get(file.slice(relative.length + 1))!) })), sourceKind: 'source' };
          qiiRecords.set(relative, row); app.records.push(row);
        }
      } catch (error) { plan.blockers.push(name + ': ' + (error instanceof Error ? error.message : 'source cannot be indexed')); }
    }
    const routes: { name?: string; path?: string }[] = [];
    const collectRoutes = (values: unknown): void => { if (!Array.isArray(values)) return; for (const value of values) if (value && typeof value === 'object') { routes.push(value); collectRoutes(value.children); } };
    collectRoutes(registration.routes);
    const targets: Map<string, MigrationRecord> = new Map(qiiRecords);
    const jsonAttachments = (file: string): MigrationRecord['files'] => {
      const directory: string = path.dirname(file);
      return walk(directory, true).filter((relative: string): boolean => relative !== 'index.json' && !relative.endsWith('/index.json')).map((relative: string) => {
        if (['entity.yml', 'metadata.yml', 'basic.yml', 'readme.md'].includes(relative)) plan.blockers.push(name + ': JSON attachment uses a reserved QiiDB filename: ' + relative);
        const source: string = contained(directory, relative); return { source, relative, sha256: hash(readFileSync(source)) };
      });
    };
    const locate = (collectionKey: string, legacyId: string, record: Fields, jsonFile?: string): void => {
      const matching: MigrationMapping[] = mapping.filter((item: MigrationMapping): boolean => item.app === name && item.collectionKey === collectionKey && item.legacyId === legacyId);
      if (matching.length > 1) { plan.blockers.push(name + ': duplicate explicit mapping for ' + legacyId); return; }
      const explicit: MigrationMapping | undefined = matching[0];
      const collectionValue: unknown = db[collectionKey]; const oldCollection: Fields = collectionValue && typeof collectionValue === 'object' ? collectionValue as Fields : {};
      const routePaths: string[] = [...new Set(routes.filter((route): boolean => route.name === collectionKey && Boolean(route.path)).map((route): string => route.path!))];
      const collectionPath: string | undefined = explicit?.collectionPath || (typeof oldCollection.path === 'string' ? oldCollection.path : routePaths.length === 1 ? routePaths[0] : undefined);
      const recordPath: string | undefined = explicit?.recordPath || (typeof record.path === 'string' ? record.path : undefined);
      if (!collectionPath || !recordPath) { plan.blockers.push(name + ': explicit collection/entity mapping required for ' + collectionKey + '/' + legacyId); return; }
      segments(collectionPath); segments(recordPath);
      const key: string = collectionPath + '/' + recordPath;
      const existing: MigrationRecord | undefined = targets.get(key);
      const fields: Fields = Object.fromEntries(Object.entries(record).filter(([field]): boolean => !(jsonFile ? (typeof record.content === 'string' ? ['content'] : []) : ['content', 'path', 'revision']).includes(field)));
      const content: string | undefined = typeof record.content === 'string' ? record.content : undefined;
      if (existing) {
        for (const [field, value] of Object.entries({ ...fields, ...(content === undefined ? {} : { content }) })) {
          const previous: unknown = field === 'content' ? existing.content : existing.fields[field];
          if (field === 'id') { if (!existing.aliases.includes(String(value))) existing.aliases.push(String(value)); continue; }
          if (previous === undefined && !jsonFile && ['cover', 'banner'].includes(field) && typeof value === 'string') {
            const image = existing.files.find((file): boolean => new RegExp('^' + field + '\\.(png|jpe?g|gif|webp)$', 'i').test(file.relative));
            if (image && readFileSync(image.source).toString('base64') === value) continue;
          }
          if (JSON.stringify(previous) === JSON.stringify(value)) continue;
          const choice = explicit?.fieldSources?.[field];
          if (!choice) { plan.blockers.push(name + ': conflicting ' + field + ' for ' + key); continue; }
          if (choice === (jsonFile ? 'json' : 'index')) { if (field === 'content') existing.content = String(value); else { existing.fields[field] = value; if (field === 'title' && /^#\s+.+$/m.test(existing.content)) existing.content = existing.content.replace(/^#\s+.+$/m, '# ' + value); } app.kind = 'mixed'; }
        }
        existing.aliases = [...new Set([...existing.aliases, legacyId, collectionKey + '/' + legacyId])];
        existing.oldUrls = [...new Set([...existing.oldUrls, '/apps/knosys/' + encodeURIComponent(name) + '/' + collectionKey + '/' + legacyId])];
        if (jsonFile) for (const attachment of jsonAttachments(jsonFile)) {
          const previous = existing.files.find((file): boolean => file.relative === attachment.relative);
          if (previous && previous.sha256 !== attachment.sha256) plan.blockers.push(name + ': attachment conflict at ' + key + '/' + attachment.relative);
          else if (!previous) existing.files.push(attachment);
        }
        if (explicit?.systemId) existing.id = explicit.systemId;
        if (jsonFile && existing.sourceKind !== 'source') existing.sourceKind = 'json';
        return;
      }
      if (!jsonFile && !explicit?.acceptIndexOnly) { plan.blockers.push(name + ': index-only record requires explicit acceptance: ' + collectionKey + '/' + legacyId); return; }
      const collectionId: string = app.collections.find((collection): boolean => collection.path === collectionPath)?.id || String(oldCollection.id || identifier('collection:' + collectionPath));
      if (!app.collections.some((collection): boolean => collection.path === collectionPath)) app.collections.push({ id: collectionId, path: collectionPath, title: String(oldCollection.title || collectionPath) });
      const row: MigrationRecord = { collectionPath, recordPath, collectionId, id: explicit?.systemId || legacyId || identifier('record:' + key), fields, content: content || '', aliases: [legacyId, collectionKey + '/' + legacyId], oldUrls: ['/apps/knosys/' + encodeURIComponent(name) + '/' + collectionKey + '/' + legacyId], files: [], sourceKind: jsonFile ? 'json' : 'index-only' };
      if (jsonFile) {
        const recordRoot: string = path.dirname(jsonFile);
        row.files = jsonAttachments(jsonFile);
      }
      targets.set(key, row); app.records.push(row);
      if (source && app.kind !== 'json') app.kind = 'mixed';
    };
    for (const full of [...new Set([...jsonRecords.map((file: string): string => path.join(jsonRoot, file)), ...additionalJson])]) {
      const relative: string = path.relative(isWithin(jsonRoot, full) ? jsonRoot : source!, path.dirname(full));
      const data: Fields = readJson<Fields>(full);
      const explicit: MigrationMapping[] = mapping.filter((item: MigrationMapping): boolean => item.app === name && (item.legacyId === (data.id === undefined || data.id === null ? relative : String(data.id)) || item.legacyId === relative));
      if (explicit.length !== 1) { plan.blockers.push(name + ': JSON entity requires explicit mapping: ' + relative); continue; }
      locate(explicit[0].collectionKey, explicit[0].legacyId, data, full);
    }
    for (const [key, value] of Object.entries(db)) if (value && typeof value === 'object' && Array.isArray((value as Fields).records)) {
      const seen: Set<string> = new Set();
      for (const record of (value as { records: Fields[] }).records) {
        const legacyId: string = (record.id === undefined || record.id === null ? '' : String(record.id));
        if (!legacyId || seen.has(legacyId)) plan.blockers.push(name + ': missing or duplicate indexed identity in ' + key);
        seen.add(legacyId); locate(key, legacyId, record);
      }
    }
    const ids: Set<string> = new Set();
    for (const record of app.records) { const key: string = record.collectionId + '\0' + record.id; if (ids.has(key)) plan.blockers.push(name + ': duplicate target identity'); ids.add(key); }
    plan.apps.push(app);
  }
  const sharedIdentities: Map<string, string> = new Map();
  for (const app of plan.apps) {
    const depths: number[] = [...new Set(app.collections.map((collection): number => segments(collection.path).length))];
    if (depths.length > 1 || (depths[0] && ![1, 2].includes(depths[0]))) plan.blockers.push(app.name + ': collection paths must share a supported category/collection schema');
    if (app.kind === 'json' && !app.registration.pathSchema && depths.length === 1) app.registration.pathSchema = depths[0] === 1 ? ':collection/:slug' : ':category/:collection/:slug';
    for (const collection of app.collections) {
      const recordDepths: number[] = [...new Set(app.records.filter((record): boolean => record.collectionPath === collection.path).map((record): number => segments(record.recordPath).length))];
      if (recordDepths.length > 1) plan.blockers.push(app.name + ': record path depths conflict in ' + collection.path);
      if (!collection.parameters) collection.parameters = recordDepths.length && recordDepths[0] > 1 ? Array.from({ length: recordDepths[0] }, (_value, index: number): string => 'segment' + (index + 1)) : ['slug'];
    }
    if (new Set(app.collections.map((collection): string => collection.id)).size !== app.collections.length) plan.blockers.push(app.name + ': duplicate collection identity');
    if (!app.source) continue;
    for (const record of app.records) {
      const key: string = app.source + '/' + record.collectionPath + '/' + record.recordPath;
      const identity: string = record.collectionId + '\0' + record.id;
      if (sharedIdentities.has(key) && sharedIdentities.get(key) !== identity) plan.blockers.push(app.name + ': shared source identity contradicts another registration');
      sharedIdentities.set(key, identity);
    }
  }
  assertTarget(target, [...roots]);
  for (const root of [...roots].sort()) { const entries: InventoryEntry[] = existsSync(root) ? inventory(root) : []; if (initial.has(root) && JSON.stringify(initial.get(root)) !== JSON.stringify(entries)) plan.blockers.push(root + ': input changed during inventory'); if (entries.some((entry: InventoryEntry): boolean => entry.type === 'symlink')) plan.blockers.push(root + ': symlinks require an explicitly materialized migration input'); plan.inventories.push({ root, entries }); }
  return plan;
}
function verifyInputs(plan: MigrationPlan): void {
  for (const input of plan.inventories) if (JSON.stringify(inventory(input.root)) !== JSON.stringify(input.entries)) fail(409, 'INPUT_CHANGED', 'Migration input changed after planning');
}
function validatePlan(plan: MigrationPlan): void {
  if (plan.schemaVersion !== 1 || !Array.isArray(plan.apps) || !Array.isArray(plan.inventories) || !Array.isArray(plan.blockers) || !path.isAbsolute(plan.target) || canonical(plan.target) !== plan.target) fail(400, 'INVALID_PLAN', 'Invalid migration plan');
  const approved: Map<string, string> = new Map();
  for (const input of plan.inventories) {
    if (!path.isAbsolute(input.root) || canonical(input.root) !== input.root || input.entries.some((entry: InventoryEntry): boolean => entry.type === 'symlink')) fail(409, 'INVALID_PLAN', 'Migration input requires canonical materialized files');
    for (const entry of input.entries) if (entry.type === 'file' && entry.sha256) approved.set(path.join(input.root, entry.path), entry.sha256);
  }
  const names: Set<string> = new Set();
  for (const app of plan.apps) {
    if (segments(app.name).length !== 1 || names.has(app.name) || !['json', 'mixed', 'qiidb'].includes(app.kind)) fail(400, 'INVALID_PLAN', 'Invalid application mapping'); names.add(app.name);
    if (app.source && !plan.inventories.some((input): boolean => input.root === app.source)) fail(400, 'INVALID_PLAN', 'Application source is not in the approved inventory');
    const ids: Set<string> = new Set();
    for (const record of app.records) {
      segments(record.collectionPath); segments(record.recordPath);
      if (typeof record.id !== 'string' || !record.id || typeof record.content !== 'string' || !record.fields || typeof record.fields !== 'object' || Array.isArray(record.fields) || !app.collections.some((collection): boolean => collection.path === record.collectionPath && collection.id === record.collectionId)) fail(400, 'INVALID_PLAN', 'Invalid record mapping');
      const key: string = record.collectionId + '\0' + record.id; if (ids.has(key)) fail(409, 'INVALID_PLAN', 'Duplicate target record identity'); ids.add(key);
      for (const file of record.files) {
        segments(file.relative, true, true);
        if (canonical(file.source) !== file.source || approved.get(file.source) !== file.sha256) fail(400, 'INVALID_PLAN', 'Record file is outside the approved input inventory');
      }
    }
  }
}
export async function applyMigration(plan: MigrationPlan): Promise<MigrationReport> {
  validatePlan(plan);
  if (plan.blockers.length) fail(409, 'MIGRATION_BLOCKED', 'Resolve all migration blockers before applying');
  assertTarget(canonical(plan.target), plan.inventories.map((input): string => input.root));
  const sourceRoots: string[] = [...new Set(plan.apps.flatMap((app): string[] => app.source ? [canonical(app.source)] : []))].sort();
  const lockRoots: string[] = [...new Set([...sourceRoots, ...plan.inventories.map((input): string => canonical(input.root)).sort()])];
  const run = async (index: number): Promise<MigrationReport> => index < lockRoots.length ? withLock(lockRoots[index], (): Promise<MigrationReport> => run(index + 1)) : execute();
  const execute = async (): Promise<MigrationReport> => {
    verifyInputs(plan); mkdirSync(plan.target);
    const report: MigrationReport = { schemaVersion: 1, status: 'incomplete', target: plan.target, inputs: plan.inventories, apps: plan.apps, outputs: [] };
    const reports: string = path.join(plan.target, 'reports'); mkdirSync(reports);
    const reportFile: string = path.join(reports, 'migration.json'); atomicWrite(reportFile, jsonBytes(report));
    const staging: string = path.join(plan.target, '.staging'); mkdirSync(staging);
    try {
      for (const app of plan.apps) {
        const source: string = app.kind === 'qiidb' ? app.source! : path.join(plan.target, 'data', app.name);
        const registration: AppRegistration = { ...app.registration, name: app.name, source, minimumWriterVersion: '0.1.0' };
        const identities: Identities = { schemaVersion: 1, collections: {} };
        for (const collection of app.collections) identities.collections[collection.path] = { id: collection.id, records: {} };
        if (app.kind !== 'qiidb') {
          mkdirSync(source, { recursive: true });
          if (app.kind === 'mixed' && app.source && existsSync(app.source)) for (const file of walk(app.source, true)) {
            if (file.startsWith('.knosys/')) continue;
            atomicWrite(path.join(source, file), readFileSync(contained(app.source, file)));
          }
          if (!existsSync(path.join(source, '.meta/basic.yml'))) atomicWrite(path.join(source, '.meta/basic.yml'), safeDump({ path: app.registration.pathSchema || ':category/:collection/:slug' }));
          for (const collection of app.collections) {
            const directory: string = contained(source, collection.path); mkdirSync(directory, { recursive: true });
            if (!['entity.yml', 'metadata.yml', 'basic.yml'].some((name: string): boolean => existsSync(path.join(directory, '.meta', name)))) atomicWrite(path.join(directory, '.meta/basic.yml'), safeDump({ title: collection.title, path: (collection.parameters || ['slug']).map((name: string): string => ':' + name).join('/') }));
          }
        }
        for (const record of app.records) {
          identities.collections[record.collectionPath].records[record.recordPath] = { id: record.id, aliases: record.aliases };
          if (app.kind === 'qiidb') continue;
          const relative: string = record.collectionPath + '/' + record.recordPath;
          const directory: string = contained(source, relative); mkdirSync(directory, { recursive: true });
          for (const file of record.files) {
            if (hash(readFileSync(file.source)) !== file.sha256) fail(409, 'INPUT_CHANGED', 'Migration attachment changed');
            atomicWrite(contained(source, relative + '/' + file.relative), readFileSync(file.source));
          }
          if (record.sourceKind !== 'source') { atomicWrite(path.join(directory, 'entity.yml'), safeDump(record.fields)); atomicWrite(path.join(directory, 'readme.md'), record.content); }
          else {
            const current = readDocument(source, relative);
            const main: string = current.main || 'entity.yml';
            const mainFields: Fields = current.main ? yamlObject(current.values.get(main)!.toString()) : {};
            const frontFields: Fields = { ...current.front.data };
            let mainChanged: boolean = false; let frontChanged: boolean = false;
            for (const [key, value] of Object.entries(record.fields)) if (JSON.stringify(current.fields[key]) !== JSON.stringify(value)) {
              if (key === 'title' && /^#\s+.+$/m.test(record.content)) continue;
              if (Object.prototype.hasOwnProperty.call(frontFields, key)) { frontFields[key] = value; frontChanged = true; }
              else { mainFields[key] = value; mainChanged = true; }
            }
            if (mainChanged) atomicWrite(path.join(directory, main), safeDump(mainFields));
            if (frontChanged || current.content !== record.content) atomicWrite(path.join(directory, 'readme.md'), (frontChanged ? '---\n' + safeDump(frontFields) + '---\n' : current.front.prefix) + record.content);
          }
          const copied = readDocument(source, relative);
          const copiedFields: Fields = record.sourceKind === 'source' ? copied.fields : { ...(copied.main ? yamlObject(copied.values.get(copied.main)!.toString()) : {}), ...copied.front.data };
          if (copied.content !== record.content || Object.entries(record.fields).some(([key, value]): boolean => JSON.stringify(copiedFields[key]) !== JSON.stringify(value))) fail(409, 'VERIFICATION_FAILED', 'Converted record differs from the approved plan');
        }
        if (app.kind !== 'qiidb') atomicWrite(path.join(source, '.knosys/record-identities.json'), jsonBytes(identities));
        const oldDb: Fields = Object.fromEntries(app.collections.map((collection) => [collection.id, { ...collection, records: app.records.filter((record): boolean => record.collectionId === collection.id).map((record) => ({ id: record.id, path: record.recordPath })) }]));
        const next = buildSnapshot(source, registration, oldDb);
        if (next.snapshot.collections.reduce((sum: number, collection: Collection): number => sum + collection.records.length, 0) !== app.records.length) fail(409, 'VERIFICATION_FAILED', 'Migrated record count differs from the plan');
        for (const expected of app.records) {
          const collection = next.snapshot.collections.find((item: Collection): boolean => item.path === expected.collectionPath && item.id === expected.collectionId);
          const actual = collection?.records.find((item: RecordProjection): boolean => item.path === expected.recordPath && item.id === expected.id);
          if (!actual || (expected.sourceKind === 'source' && (actual.content !== expected.content || Object.entries(expected.fields).some(([key, value]): boolean => JSON.stringify(actual.fields[key]) !== JSON.stringify(value))))) fail(409, 'VERIFICATION_FAILED', 'Migrated identity or effective content differs from the approved plan');
        }
        const directory: string = path.join(staging, app.name); mkdirSync(directory);
        atomicWrite(path.join(directory, 'app.json'), jsonBytes(registration)); atomicWrite(path.join(directory, 'db.json'), indexBytes(next.snapshot));
        atomicWrite(path.join(directory, 'legacy-map.json'), jsonBytes([...app.collections.map((collection) => ({ collection: collection.id, aliases: [collection.path], oldUrls: ['/apps/knosys/' + encodeURIComponent(app.name) + '/' + collection.path] })), ...app.records.map((record) => ({ collection: record.collectionId, record: record.id, aliases: record.aliases, oldUrls: record.oldUrls }))]));
      }
      verifyInputs(plan);
      const destination: string = path.join(plan.target, 'apps'); renameSync(staging, destination);
      report.status = 'complete'; report.outputs = inventory(plan.target).filter((entry: InventoryEntry): boolean => entry.path !== 'reports' && !entry.path.startsWith('reports/'));
      atomicWrite(reportFile, jsonBytes(report)); return report;
    } catch (error) { report.error = error instanceof Error ? error.message : 'Migration failed'; atomicWrite(reportFile, jsonBytes(report)); throw error; }
  };
  return run(0);
}
export function verifyMigration(report: MigrationReport): { verified: true; applications: number; records: number } {
  if (report.schemaVersion !== 1 || report.status !== 'complete') fail(409, 'MIGRATION_INCOMPLETE', 'Migration report is incomplete');
  const current: InventoryEntry[] = inventory(report.target).filter((entry: InventoryEntry): boolean => entry.path !== 'reports' && !entry.path.startsWith('reports/'));
  if (JSON.stringify(current) !== JSON.stringify(report.outputs)) fail(409, 'TARGET_CHANGED', 'Migrated target changed after verification');
  for (const app of report.apps) if (app.kind === 'qiidb' && app.source) {
    const original = report.inputs.find((input): boolean => input.root === app.source);
    if (!original || JSON.stringify(inventory(app.source)) !== JSON.stringify(original.entries)) fail(409, 'EXTERNAL_SOURCE_CHANGED', 'Referenced external QiiDB source changed');
  }
  return { verified: true, applications: report.apps.length, records: report.apps.reduce((sum: number, app: MigrationApp): number => sum + app.records.length, 0) };
}
