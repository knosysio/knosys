import { existsSync, readdirSync, readFileSync, mkdirSync, rmdirSync, lstatSync, renameSync } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
const { safeDump } = yaml;
import { randomBytes } from 'crypto';
import { canonical, contained, isWithin, segments, readJson, atomicWrite, jsonBytes, hash, removeFile, walk } from './files';
import { withLock } from './lock';
import { transact, recoverTransactions, type Mutation } from './transaction';
import { readDocument, patchDocument, validateFields, type Overlay } from './document';
import { buildSnapshot, indexBytes, readSchema } from './snapshot';
import { fail, type Fields, type StorageOptions, type AppRegistration, type Snapshot, type Collection, type RecordProjection, type EditableDocument, type InitializeInput, type RecordInput, type DocumentPatch } from './contracts';
export * from './contracts';
export { recoverLock } from './lock';

export function createStorage(options: StorageOptions) {
  if (!path.isAbsolute(options.appsRoot) || !options.allowedRoots.every((root: string): boolean => path.isAbsolute(root))) fail(400, 'INVALID_ROOT', 'Storage roots must be absolute paths');
  const appsRoot: string = canonical(options.appsRoot);
  const allowedRoots: string[] = options.allowedRoots.map(canonical);
  const managedRoots: string[] = (options.managedRoots || []).map(canonical);
  if (!options.allowManagedRegistration && managedRoots.some((root: string): boolean => isWithin(root, appsRoot))) fail(403, 'MANAGED_ROOT', 'Independent registrations cannot use host-managed storage');
  function loadApp(name: string): { registration: AppRegistration; directory: string; source: string; identifier: string } {
    if (segments(name).length !== 1) fail(400, 'INVALID_APP', 'Application identifier must be a single name');
    if (!existsSync(appsRoot)) fail(404, 'APP_NOT_FOUND', 'Application does not exist');
    const directory: string = contained(appsRoot, name);
    if (!existsSync(contained(appsRoot, name + '/app.json'))) fail(404, 'APP_NOT_FOUND', 'Application does not exist');
    const registration: AppRegistration = readJson<AppRegistration>(contained(appsRoot, name + '/app.json'));
    if (existsSync(path.join(directory, 'knosys')) && walk(path.join(directory, 'knosys'), true).some((file: string): boolean => file === 'index.json' || file.endsWith('/index.json'))) fail(409, 'MIGRATION_REQUIRED', 'Legacy JSON records require explicit migration');
    if (!registration.source || !path.isAbsolute(registration.source)) fail(409, 'MIGRATION_REQUIRED', 'Application requires explicit migration to QiiDB');
    if (registration.name && registration.name !== name) fail(409, 'APP_BINDING_CONFLICT', 'Registration name conflicts with its application identifier');
    const source: string = canonical(registration.source);
    if (!existsSync(source)) fail(503, 'SOURCE_UNAVAILABLE', 'Application source is unavailable');
    if (source !== registration.source) fail(503, 'SOURCE_CHANGED', 'Registered source realpath changed; register it again');
    return { registration, directory, source, identifier: name };
  }
  function assertQiiSource(source: string, snapshot: Snapshot): void {
    const files: string[] = walk(source);
    const entity: boolean = snapshot.collections.some((collection: Collection): boolean => collection.records.length > 0);
    if (!entity && files.some((file: string): boolean => file === 'index.json' || file.endsWith('/index.json'))) fail(409, 'MIGRATION_REQUIRED', 'Legacy JSON source requires explicit migration');
  }
  async function useApp<T>(name: string, operation: (app: ReturnType<typeof loadApp>, snapshot: Snapshot) => T | Promise<T>): Promise<T> {
    const app = loadApp(name);
    return withLock(app.source, async (): Promise<T> => {
      const checked = loadApp(name);
      if (checked.source !== app.source) fail(409, 'SOURCE_CHANGED', 'Application binding changed');
      recoverTransactions(app.source, appsRoot);
      const oldDb: Fields = readJson<Fields>(contained(appsRoot, app.identifier + '/db.json'), {});
      const { snapshot } = buildSnapshot(app.source, app.registration, oldDb);
      assertQiiSource(app.source, snapshot);
      return operation(app, snapshot);
    });
  }
  function findCollection(snapshot: Snapshot, id: string): Collection { const collection: Collection | undefined = snapshot.collections.find((item: Collection): boolean => item.id === id); return collection || fail(404, 'COLLECTION_NOT_FOUND', 'Collection does not exist'); }
  function findRecord(collection: Collection, id: string): RecordProjection { return collection.records.find((item: RecordProjection): boolean => item.id === id) || fail(404, 'RECORD_NOT_FOUND', 'Record does not exist'); }
  function assertWritable(source: string, registration: AppRegistration): void { if (registration.minimumWriterVersion !== '0.1.0') fail(409, registration.minimumWriterVersion ? 'WRITER_UPGRADE_REQUIRED' : 'MIGRATION_REQUIRED', 'Use an explicitly migrated or registered application with a supported minimum writer version'); if (managedRoots.some((root: string): boolean => isWithin(root, source))) fail(409, 'SOURCE_MIGRATION_REQUIRED', 'Move source outside the host-managed deletion scope before writing'); }
  function commit(app: ReturnType<typeof loadApp>, changes: Mutation[], removedDirectories: string[] = []): Snapshot {
    assertWritable(app.source, app.registration);
    const overlay: Overlay = new Map(changes.map((change: Mutation): [string, Buffer | null] => [path.relative(app.source, change.file).split(path.sep).join('/'), change.bytes]));
    const next = buildSnapshot(app.source, app.registration, readJson<Fields>(contained(appsRoot, app.identifier + '/db.json'), {}), overlay);
    transact(app.source, appsRoot, [...changes, { file: path.join(app.source, '.knosys/record-identities.json'), bytes: jsonBytes(next.identities) }, { file: contained(appsRoot, app.identifier + '/db.json'), bytes: indexBytes(next.snapshot) }], options.fault, removedDirectories);
    return next.snapshot;
  }
  function recordDirectories(directory: string): string[] {
    const result: string[] = [directory];
    for (const name of readdirSync(directory)) { const full: string = path.join(directory, name); if (lstatSync(full).isDirectory()) result.push(...recordDirectories(full)); }
    return result;
  }
  const service = {
    appsRoot,
    async listApps(): Promise<(AppRegistration & { status: string })[]> {
      if (!existsSync(appsRoot)) return [];
      const result: (AppRegistration & { status: string })[] = [];
      for (const name of readdirSync(appsRoot).sort()) {
        if (name.startsWith('.')) continue;
        const directory: string = contained(appsRoot, name);
        if (!lstatSync(directory).isDirectory() || !existsSync(contained(appsRoot, name + '/app.json'))) continue;
        const registration: AppRegistration = readJson<AppRegistration>(contained(appsRoot, name + '/app.json'));
        let status: string = !registration.source || !registration.minimumWriterVersion ? 'MIGRATION_REQUIRED' : registration.minimumWriterVersion !== '0.1.0' ? 'WRITER_UPGRADE_REQUIRED' : !existsSync(registration.source) ? 'SOURCE_UNAVAILABLE' : 'available';
        if (status === 'available') { try { await service.getSnapshot(name); } catch (error) { status = error instanceof Error && 'code' in error ? String(error.code) : 'SOURCE_UNAVAILABLE'; } }
        result.push({ ...registration, name, status });
      }
      return result;
    },
    async getSnapshot(name: string): Promise<Snapshot> { return useApp(name, (app, snapshot: Snapshot): Snapshot => ({ ...snapshot, writable: app.registration.minimumWriterVersion === '0.1.0' && !managedRoots.some((root: string): boolean => isWithin(root, app.source)) })); },
    async getDocument(name: string, collectionId: string, recordId: string): Promise<EditableDocument> {
      return useApp(name, (app, snapshot: Snapshot): EditableDocument => {
        const collection: Collection = findCollection(snapshot, collectionId);
        const record: RecordProjection = findRecord(collection, recordId);
        return { id: record.id, content: record.content, fields: record.fields, revision: record.revision, attachments: record.attachments, writable: app.registration.minimumWriterVersion === '0.1.0' && !managedRoots.some((root: string): boolean => isWithin(root, app.source)) };
      });
    },
    async createRecord(name: string, collectionId: string, input: RecordInput): Promise<RecordProjection> {
      return useApp(name, (app, snapshot: Snapshot): RecordProjection => {
        const collection: Collection = findCollection(snapshot, collectionId);
        if (!input.parameters || Object.keys(input.parameters).sort().join() !== [...collection.parameters].sort().join()) fail(400, 'INVALID_PARAMETERS', 'Record parameters must match the collection schema');
        const parts: string[] = collection.parameters.map((parameter: string): string => {
          const value: string = input.parameters[parameter];
          if (typeof value !== 'string' || segments(value).length !== 1) fail(400, 'INVALID_PARAMETERS', 'Invalid record path parameter');
          return value;
        });
        validateFields(input.fields || {});
        if (input.content !== undefined && typeof input.content !== 'string') fail(400, 'INVALID_CONTENT', 'Content must be text');
        const relative: string = collection.path + '/' + parts.join('/');
        const target: string = contained(app.source, relative);
        if (existsSync(target)) fail(409, 'RECORD_EXISTS', 'Record target already exists');
        const next: Snapshot = commit(app, [{ file: path.join(target, 'entity.yml'), bytes: Buffer.from(safeDump(input.fields || {})) }, { file: path.join(target, 'readme.md'), bytes: Buffer.from(input.content || '') }]);
        return next.collections.find((item: Collection): boolean => item.id === collectionId)!.records.find((record: RecordProjection): boolean => record.path === parts.join('/'))!;
      });
    },
    async updateRecord(name: string, collectionId: string, recordId: string, patch: DocumentPatch): Promise<EditableDocument> {
      await useApp(name, (app, snapshot: Snapshot): void => {
        const collection: Collection = findCollection(snapshot, collectionId);
        const record: RecordProjection = findRecord(collection, recordId);
        const changes: Mutation[] = patchDocument(app.source, collection.path + '/' + record.path, patch);
        if (changes.length) commit(app, changes);
      });
      return service.getDocument(name, collectionId, recordId);
    },
    async deleteRecord(name: string, collectionId: string, recordId: string, expectedRevision: string): Promise<void> {
      await useApp(name, (app, snapshot: Snapshot): void => {
        const collection: Collection = findCollection(snapshot, collectionId);
        const record: RecordProjection = findRecord(collection, recordId);
        if (record.revision !== expectedRevision) fail(409, 'REVISION_CONFLICT', 'Record changed; reload before deleting');
        const relative: string = collection.path + '/' + record.path;
        const document = readDocument(app.source, relative);
        commit(app, document.files.map((file: string): Mutation => ({ file: contained(app.source, file), bytes: null })), recordDirectories(contained(app.source, relative)));
      });
    },
    async getAttachment(name: string, collectionId: string, recordId: string, attachmentId: string): Promise<{ name: string; bytes: Buffer }> {
      return useApp(name, (app, snapshot: Snapshot): { name: string; bytes: Buffer } => {
        const collection: Collection = findCollection(snapshot, collectionId);
        const record: RecordProjection = findRecord(collection, recordId);
        const attachment = record.attachments.find((item): boolean => item.id === attachmentId);
        if (!attachment) fail(404, 'ATTACHMENT_NOT_FOUND', 'Attachment does not exist');
        return { name: attachment.name, bytes: readFileSync(contained(app.source, collection.path + '/' + record.path + '/' + attachment.relativePath)) };
      });
    },
    async rebuild(name: string): Promise<Snapshot> {
      return useApp(name, (app): Snapshot => commit(app, []));
    },
    async resolveLegacy(name: string, lookup: { id?: string; url?: string; collectionPath?: string }): Promise<{ collection: string; record?: string }[]> {
      return useApp(name, (app, snapshot: Snapshot): { collection: string; record?: string }[] => {
        const mapping = readJson<{ collection: string; record?: string; aliases: string[]; oldUrls: string[] }[]>(contained(appsRoot, app.identifier + '/legacy-map.json'), []);
        const found: { collection: string; record?: string }[] = mapping.filter((item): boolean => Boolean(lookup.id && item.aliases.includes(lookup.id)) || Boolean(lookup.url && item.oldUrls.includes(lookup.url))).map((item) => ({ collection: item.collection, ...(item.record ? { record: item.record } : {}) }));
        if (lookup.collectionPath) for (const collection of snapshot.collections) if (collection.path === lookup.collectionPath) found.push({ collection: collection.id });
        if (lookup.id) for (const collection of snapshot.collections) for (const record of collection.records) if (record.id === lookup.id) found.push({ collection: collection.id, record: record.id });
        const unique = [...new Map(found.map((item): [string, typeof item] => [JSON.stringify(item), item])).values()];
        return unique.filter((item): boolean => snapshot.collections.some((collection): boolean => collection.id === item.collection && (!item.record || collection.records.some((record): boolean => record.id === item.record))));
      });
    },
    async changeLegacyRecord(name: string, collectionId: string, recordId: string, changes: Fields | null): Promise<void> {
      await useApp(name, (app, snapshot: Snapshot): void => {
        if (!app.registration.minimumWriterVersion) fail(409, 'MIGRATION_REQUIRED', 'Migrate or explicitly register this source before legacy writes');
        const collection: Collection = findCollection(snapshot, collectionId); const record: RecordProjection = findRecord(collection, recordId);
        const relative: string = collection.path + '/' + record.path;
        if (changes === null) { commit(app, readDocument(app.source, relative).files.map((file: string): Mutation => ({ file: contained(app.source, file), bytes: null })), recordDirectories(contained(app.source, relative))); return; }
        const content: unknown = changes.content;
        const editable: string[] = ['title', 'description', 'date', 'tags'];
        const projection: string[] = ['id', 'path', 'revision', 'createdAt', 'updatedAt'];
        for (const [key, value] of Object.entries(changes)) if (key !== 'content' && !editable.includes(key) && !projection.includes(key) && JSON.stringify(record.fields[key]) !== JSON.stringify(value)) fail(400, 'FIELD_NOT_EDITABLE', 'Legacy clients cannot change unsupported fields');
        const fields: Fields = Object.fromEntries(Object.entries(changes).filter(([key]): boolean => editable.includes(key)));
        const mutations: Mutation[] = patchDocument(app.source, relative, { fields, ...(content === undefined ? {} : { content: content as string }), expectedRevision: record.revision });
        if (mutations.length) commit(app, mutations);
      });
    },
    async getConfiguration(name: string): Promise<{ fields: Fields; revision: string }> {
      return useApp(name, (app): { fields: Fields; revision: string } => ({ fields: { title: app.registration.title || '' }, revision: hash(readFileSync(contained(appsRoot, app.identifier + '/app.json'))) }));
    },
    async updateConfiguration(name: string, changes: Fields, expectedRevision: string): Promise<void> {
      await useApp(name, async (app): Promise<void> => withLock(appsRoot, (): void => {
        if (!changes || Object.keys(changes).some((key: string): boolean => key !== 'title') || (changes.title !== undefined && typeof changes.title !== 'string')) fail(400, 'CONFIGURATION_FORBIDDEN', 'Only the display title can be changed');
        const file: string = contained(appsRoot, app.identifier + '/app.json');
        if (hash(readFileSync(file)) !== expectedRevision) fail(409, 'REVISION_CONFLICT', 'Configuration changed; reload before saving');
        atomicWrite(file, jsonBytes({ ...app.registration, ...changes }));
      }));
    },
    async initialize(input: InitializeInput): Promise<AppRegistration> {
      if (!input || !['register', 'create'].includes(input.mode) || !path.isAbsolute(input.projectRoot || '') || segments(input.appName).length !== 1) fail(400, 'INVALID_INITIALIZATION', 'Invalid initialization parameters');
      const project: string = canonical(input.projectRoot);
      if (!existsSync(project) || !lstatSync(project).isDirectory() || !allowedRoots.some((root: string): boolean => isWithin(root, project))) fail(403, 'ROOT_NOT_ALLOWED', 'Project root is not authorized by startup configuration');
      if (typeof input.sourceRelative !== 'string' || !input.sourceRelative || path.isAbsolute(input.sourceRelative)) fail(400, 'INVALID_PATH', 'Source must be a project-relative path');
      const sourceRelative: string = input.sourceRelative.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '') || '.';
      if (sourceRelative !== '.') segments(sourceRelative, true);
      const source: string = sourceRelative === '.' ? project : canonical(contained(project, sourceRelative));
      if (managedRoots.some((root: string): boolean => isWithin(root, source))) fail(403, 'MANAGED_ROOT', 'QiiDB source must be outside host-managed directories');
      const registration: AppRegistration = { name: input.appName, title: input.title || input.appName, source, ...(input.pathSchema ? { pathSchema: input.pathSchema } : {}), minimumWriterVersion: '0.1.0' };
      return withLock(source, async (): Promise<AppRegistration> => withLock(appsRoot, (): AppRegistration => {
        if (canonical(appsRoot) !== appsRoot || canonical(source) !== source || !isWithin(project, source)) fail(403, 'ROOT_CHANGED', 'Storage realpath changed after authorization');
        mkdirSync(appsRoot, { recursive: true });
        const directory: string = contained(appsRoot, input.appName);
        if (isWithin(source, appsRoot) || isWithin(source, directory) || isWithin(directory, source)) fail(409, 'REGISTRATION_SOURCE_OVERLAP', 'Source and registration must have separate directory ownership');
        if (existsSync(directory)) fail(409, 'APP_EXISTS', 'Application registration already exists');
        if (input.mode === 'create' && existsSync(source)) fail(409, 'SOURCE_EXISTS', 'Source target must not exist');
        if (input.mode === 'register' && !existsSync(source)) fail(404, 'SOURCE_NOT_FOUND', 'Existing source does not exist');
        if (input.mode === 'register') { if (!lstatSync(source).isDirectory()) fail(400, 'INVALID_SOURCE', 'QiiDB source must be a directory'); recoverTransactions(source, appsRoot); }
        const created: { file: string; bytes: Buffer }[] = [];
        const directories: string[] = [];
        const ensureDirectory = (target: string): void => {
          if (!isWithin(project, canonical(target))) fail(403, 'PATH_ESCAPE', 'Initialization target escapes its authorized project');
          if (existsSync(target)) return;
          ensureDirectory(path.dirname(target)); mkdirSync(target); directories.push(target);
        };
        const stage: string = path.join(appsRoot, '.initialize-' + randomBytes(12).toString('hex'));
        try {
          if (input.mode === 'create') {
            const schema: string[] = readSchema(project, { ...registration, pathSchema: input.pathSchema || ':category/:collection/:slug' });
            const collection: string = input.collection || (schema[0] === 'category' ? 'kb/notes' : 'notes');
            if (segments(collection).length !== (schema[0] === 'category' ? 2 : 1)) fail(400, 'INVALID_COLLECTION', 'Initial collection does not match path schema');
            ensureDirectory(source);
            const files: { file: string; bytes: Buffer }[] = [{ file: path.join(source, '.meta/basic.yml'), bytes: Buffer.from(safeDump({ title: input.title || input.appName, path: input.pathSchema || ':category/:collection/:slug' })) }, { file: path.join(contained(source, collection), '.meta/basic.yml'), bytes: Buffer.from(safeDump({ title: collection.split('/').pop() })) }];
            for (const item of files) { ensureDirectory(path.dirname(item.file)); atomicWrite(item.file, item.bytes); created.push(item); }
          }
          const next = buildSnapshot(source, registration);
          assertQiiSource(source, next.snapshot);
          if (input.mode === 'create') {
            const identity = { file: path.join(source, '.knosys/record-identities.json'), bytes: jsonBytes(next.identities) };
            ensureDirectory(path.dirname(identity.file)); atomicWrite(identity.file, identity.bytes); created.push(identity);
          }
          mkdirSync(stage);
          atomicWrite(path.join(stage, 'app.json'), jsonBytes(registration));
          atomicWrite(path.join(stage, 'db.json'), indexBytes(next.snapshot));
          renameSync(stage, directory);
          return registration;
        } catch (error) {
          for (const item of created.reverse()) if (existsSync(item.file) && hash(readFileSync(item.file)) === hash(item.bytes)) removeFile(item.file);
          for (const target of directories.reverse()) if (existsSync(target) && readdirSync(target).length === 0) rmdirSync(target);
          if (existsSync(stage)) { removeFile(path.join(stage, 'app.json')); removeFile(path.join(stage, 'db.json')); rmdirSync(stage); }
          throw error;
        }
      }));
    },
  };
  return service;
}
export type StorageService = ReturnType<typeof createStorage>;
