export type Fields = Record<string, unknown>;
export interface StorageOptions { appsRoot: string; allowedRoots: string[]; managedRoots?: string[]; allowManagedRegistration?: boolean; fault?: (stage: string) => void }
export interface AppRegistration { name: string; title?: string; source: string; pathSchema?: string; minimumWriterVersion?: string; routes?: unknown; [key: string]: unknown }
export interface Attachment { id: string; name: string; relativePath: string; sha256: string }
export interface EditableDocument { id: string; content: string; fields: Fields; revision: string; attachments: Attachment[]; writable?: boolean }
export interface RecordProjection { id: string; path: string; fields: Fields; content: string; revision: string; attachments: Attachment[]; writable?: boolean }
export interface Collection { id: string; path: string; title: string; parameters: string[]; records: RecordProjection[] }
export interface Snapshot { collections: Collection[]; revision: string; writable?: boolean }
export interface InitializeInput { mode: 'register' | 'create'; projectRoot: string; sourceRelative: string; appName: string; title?: string; pathSchema?: string; collection?: string }
export interface RecordInput { parameters: Record<string, string>; fields?: Fields; content?: string }
export interface DocumentPatch { fields?: Fields; content?: string; expectedRevision: string }
export class StorageError extends Error {
  public readonly status: number;
  public readonly code: string;
  public constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; }
}
export function fail(status: number, code: string, message: string): never { throw new StorageError(status, code, message); }
