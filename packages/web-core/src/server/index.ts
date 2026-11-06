import Router from '@koa/router';
import type { Context, Middleware } from 'koa';
import { createStorage, StorageError, type StorageOptions, type Fields, type RecordProjection, type Snapshot } from '@knosys/sdk/app';
import { operations, type OperationCategory } from '../contracts/index';

export interface ServerOptions extends StorageOptions { authorize: (ctx: Context, category: OperationCategory) => boolean | Promise<boolean>; isAdministrator: (ctx: Context) => boolean }
export function categoryFor(method: string, pathname: string): OperationCategory {
  const normalized: string = method === 'HEAD' ? 'GET' : method;
  if (pathname === '/api/knosys/settings') return 'manage';
  return operations.find(([verb, route]): boolean => normalized === verb && pathname === '/api/knosys/v1' + route)?.[2] || (normalized === 'GET' ? 'read' : 'write');
}
function parameter(ctx: Context, key: string): string {
  const value: unknown = ctx.query[key];
  if (typeof value !== 'string' || !value || value.includes('\0')) throw new StorageError(400, 'INVALID_PARAMETER', 'Missing or invalid parameter: ' + key);
  return value;
}
function pagination(ctx: Context): { pageNum: number; pageSize: number } {
  const parse = (key: string, fallback: number): number => {
    const raw: unknown = ctx.query[key];
    if (raw === undefined) return fallback;
    if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new StorageError(400, 'INVALID_PAGINATION', 'Invalid pagination');
    return Number(raw);
  };
  const pageNum: number = parse('pageNum', 1); const pageSize: number = parse('pageSize', 20);
  if (pageSize > 100) throw new StorageError(400, 'INVALID_PAGINATION', 'Page size cannot exceed 100');
  return { pageNum, pageSize };
}
function sorted(records: RecordProjection[]): RecordProjection[] {
  const time = (record: RecordProjection): number => { const date: number = Date.parse(String(record.fields.date || record.fields.createdAt || '')); return Number.isFinite(date) ? date : -Infinity; };
  return [...records].sort((a: RecordProjection, b: RecordProjection): number => time(b) - time(a) || a.id.localeCompare(b.id));
}
function body(ctx: Context): Fields {
  const value: unknown = (ctx.request as typeof ctx.request & { body?: unknown }).body;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new StorageError(400, 'INVALID_BODY', 'JSON object body required');
  return value as Fields;
}
function attachmentType(bytes: Buffer): string | undefined {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString())) return 'image/gif';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return undefined;
}
export function createKnosysRouter(options: ServerOptions): Router {
  const service = createStorage(options);
  const router: Router = new Router();
  const handle = (category: OperationCategory, action: (ctx: Context) => Promise<unknown>): Middleware => async (ctx: Context): Promise<void> => {
    try {
      if (!await options.authorize(ctx, category)) throw new StorageError(403, 'FORBIDDEN', 'You are not authorized for this operation');
      ctx.body = { success: true, data: await action(ctx) };
    } catch (error) {
      const known: boolean = error instanceof StorageError;
      ctx.status = known ? (error as StorageError).status : 503;
      ctx.body = { success: false, code: known ? (error as StorageError).code : 'SOURCE_UNAVAILABLE', message: known ? (error as Error).message : 'Application source is unavailable' };
    }
  };
  const snapshot = async (ctx: Context): Promise<Snapshot> => service.getSnapshot(parameter(ctx, 'app'));
  router.get('/api/knosys/v1/apps', handle('read', async (ctx: Context): Promise<unknown> => (await service.listApps()).map((app) => options.isAdministrator(ctx) ? app : { name: app.name, title: app.title, status: app.status, routes: app.routes })));
  router.get('/api/knosys/v1/collections', handle('read', async (ctx: Context): Promise<unknown> => (await (async () => { const current = await snapshot(ctx); return current.collections.map(({ records: _records, ...collection }) => ({ ...collection, capabilities: { create: current.writable !== false, edit: current.writable !== false, delete: current.writable !== false } })); })())));
  router.get('/api/knosys/v1/records', async (ctx: Context): Promise<void> => {
    await handle('read', async (): Promise<unknown> => {
      const { pageNum, pageSize } = pagination(ctx);
      const current = await snapshot(ctx);
      const collection = current.collections.find((item): boolean => item.id === parameter(ctx, 'collection'));
      if (!collection) throw new StorageError(404, 'COLLECTION_NOT_FOUND', 'Collection does not exist');
      const records: RecordProjection[] = sorted(collection.records);
      ctx.state.knosysPagination = { total: records.length, pageNum, pageSize, writable: current.writable !== false };
      return records.slice((pageNum - 1) * pageSize, pageNum * pageSize);
    })(ctx, async (): Promise<void> => {});
    if (ctx.status < 400) ctx.body = { ...(ctx.body as Fields), extra: ctx.state.knosysPagination };
  });
  router.get('/api/knosys/v1/record', handle('read', async (ctx: Context): Promise<unknown> => service.getDocument(parameter(ctx, 'app'), parameter(ctx, 'collection'), parameter(ctx, 'record'))));
  router.get('/api/knosys/v1/document', handle('read', async (ctx: Context): Promise<unknown> => service.getDocument(parameter(ctx, 'app'), parameter(ctx, 'collection'), parameter(ctx, 'record'))));
  router.post('/api/knosys/v1/record', handle('write', async (ctx: Context): Promise<unknown> => service.createRecord(parameter(ctx, 'app'), parameter(ctx, 'collection'), body(ctx) as unknown as Parameters<typeof service.createRecord>[2])));
  router.put('/api/knosys/v1/record', handle('write', async (ctx: Context): Promise<unknown> => service.updateRecord(parameter(ctx, 'app'), parameter(ctx, 'collection'), parameter(ctx, 'record'), body(ctx) as unknown as Parameters<typeof service.updateRecord>[3])));
  router.delete('/api/knosys/v1/record', handle('write', async (ctx: Context): Promise<unknown> => { await service.deleteRecord(parameter(ctx, 'app'), parameter(ctx, 'collection'), parameter(ctx, 'record'), body(ctx).expectedRevision as string); return null; }));
  router.get('/api/knosys/v1/settings', handle('manage', async (): Promise<unknown> => ({ storageRoot: service.appsRoot, allowedRoots: options.allowedRoots, managedRoots: options.managedRoots || [], format: 'QiiDB', minimumWriterVersion: '0.1.0' })));
  router.post('/api/knosys/v1/initialize', handle('manage', async (ctx: Context): Promise<unknown> => service.initialize(body(ctx) as unknown as Parameters<typeof service.initialize>[0])));
  router.get('/api/knosys/v1/configuration', handle('manage', async (ctx: Context): Promise<unknown> => service.getConfiguration(parameter(ctx, 'app'))));
  router.put('/api/knosys/v1/configuration', handle('manage', async (ctx: Context): Promise<unknown> => { const input: Fields = body(ctx); await service.updateConfiguration(parameter(ctx, 'app'), input.changes as Fields, input.expectedRevision as string); return null; }));
  router.get('/api/knosys/v1/attachment', async (ctx: Context): Promise<void> => {
    let attachment: { name: string; bytes: Buffer } | undefined;
    await handle('read', async (): Promise<unknown> => { attachment = await service.getAttachment(parameter(ctx, 'app'), parameter(ctx, 'collection'), parameter(ctx, 'record'), parameter(ctx, 'attachment')); return null; })(ctx, async (): Promise<void> => {});
    if (!attachment) return;
    const type: string | undefined = attachmentType(attachment.bytes);
    ctx.set('X-Content-Type-Options', 'nosniff'); ctx.set('Content-Security-Policy', "default-src 'none'; sandbox");
    ctx.type = type || 'application/octet-stream';
    ctx.set('Content-Disposition', (type ? 'inline' : 'attachment') + "; filename*=UTF-8''" + encodeURIComponent(attachment.name));
    ctx.body = attachment.bytes;
  });
  router.get('/api/knosys/apps', handle('read', async (ctx: Context): Promise<unknown> => (await service.listApps()).map((app) => options.isAdministrator(ctx) ? app : { name: app.name, title: app.title, routes: app.routes, status: app.status })));
  router.get('/api/knosys/settings', handle('manage', async (): Promise<unknown> => ({ storageRoot: service.appsRoot, hasKnsyDir: existsSync(path.join(homedir(), '.knosys')) })));
  router.get('/api/knosys/v1/legacy', handle('read', async (ctx: Context): Promise<unknown> => {
    const url: string = parameter(ctx, 'url'); if (/%2f|%5c/i.test(url)) throw new StorageError(400, 'INVALID_LEGACY_URL', 'Encoded path separators are not supported');
    return service.resolveLegacy(parameter(ctx, 'app'), { url: decodeURI(url) });
  }));
  router.get('/api/knosys/apps/:name', async (ctx: Context): Promise<void> => {
    await handle('read', async (): Promise<unknown> => {
      const name: string = ctx.params.name; const { pageNum, pageSize } = pagination(ctx); const current = await service.getSnapshot(name);
      const datasetPath: unknown = ctx.query.datasetPath;
      const candidates = datasetPath === undefined ? [] : await service.resolveLegacy(name, { collectionPath: String(datasetPath) });
      if (datasetPath !== undefined && candidates.length !== 1) throw new StorageError(409, 'AMBIGUOUS_LEGACY_MAPPING', 'Collection mapping is missing or ambiguous');
      const records = sorted(current.collections.filter((collection): boolean => datasetPath === undefined || collection.id === candidates[0].collection).flatMap((collection) => collection.records));
      ctx.state.knosysPagination = { total: records.length, pageNum, pageSize, writable: current.writable !== false };
      const app = (await service.listApps()).find((item): boolean => item.name === name)!;
      return { name, title: app.title, routes: app.routes, ...(options.isAdministrator(ctx) ? { source: app.source } : {}), records: records.slice((pageNum - 1) * pageSize, pageNum * pageSize).map((record) => ({ ...record.fields, id: record.id, path: record.path })) };
    })(ctx, async (): Promise<void> => {});
    if (ctx.status < 400) ctx.body = { ...(ctx.body as Fields), extra: ctx.state.knosysPagination };
  });
  const legacyRecord = async (ctx: Context): Promise<{ collection: string; record: string }> => {
    if (ctx.params.id.includes('/')) throw new StorageError(400, 'INVALID_LEGACY_ID', 'Use the query API for IDs containing separators');
    const candidates = (await service.resolveLegacy(ctx.params.name, { id: ctx.params.id })).filter((item): item is { collection: string; record: string } => Boolean(item.record));
    if (candidates.length !== 1) throw new StorageError(candidates.length ? 409 : 404, candidates.length ? 'AMBIGUOUS_LEGACY_MAPPING' : 'NOT_FOUND', 'Legacy record mapping is missing or ambiguous');
    return candidates[0];
  };
  router.get('/api/knosys/apps/:name/:id', handle('read', async (ctx: Context): Promise<unknown> => { const target = await legacyRecord(ctx); const document = await service.getDocument(ctx.params.name, target.collection, target.record); const current = await service.getSnapshot(ctx.params.name); const collection = current.collections.find((item): boolean => item.id === target.collection)!; const record = collection.records.find((item): boolean => item.id === target.record); if (!record) throw new StorageError(404, 'NOT_FOUND', 'Record no longer exists'); return { record: { ...document.fields, id: ctx.params.id, path: collection.path + '/' + record.path, revision: document.revision }, data: { ...document.fields, content: document.content }, revision: document.revision }; }));
  router.put('/api/knosys/apps/:name/:id', handle('write', async (ctx: Context): Promise<unknown> => { const target = await legacyRecord(ctx); const data: unknown = body(ctx).data; if (!data || typeof data !== 'object' || Array.isArray(data)) throw new StorageError(400, 'INVALID_BODY', 'data must be an object'); await service.changeLegacyRecord(ctx.params.name, target.collection, target.record, data as Fields); return null; }));
  router.delete('/api/knosys/apps/:name/:id', handle('write', async (ctx: Context): Promise<unknown> => { const target = await legacyRecord(ctx); await service.changeLegacyRecord(ctx.params.name, target.collection, target.record, null); return null; }));
  router.post('/api/knosys/apps/:name', handle('write', async (ctx: Context): Promise<unknown> => {
    const input: Fields = body(ctx); const candidates = await service.resolveLegacy(ctx.params.name, { collectionPath: String(input.category || '') });
    if (candidates.length !== 1) throw new StorageError(409, 'AMBIGUOUS_LEGACY_MAPPING', 'Creation requires a unique explicit collection mapping');
    const current = await service.getSnapshot(ctx.params.name); const collection = current.collections.find((item): boolean => item.id === candidates[0].collection)!;
    if (collection.parameters.length !== 1 || typeof input.item !== 'string') throw new StorageError(409, 'AMBIGUOUS_LEGACY_MAPPING', 'Creation path cannot be mapped uniquely');
    const data: Fields = input.data && typeof input.data === 'object' && !Array.isArray(input.data) ? input.data as Fields : {};
    const { content, ...fields } = data;
    return service.createRecord(ctx.params.name, collection.id, { parameters: { [collection.parameters[0]]: input.item }, fields, content: typeof content === 'string' ? content : '' });
  }));
  return router;
}
import { existsSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
