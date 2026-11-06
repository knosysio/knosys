import type { ComponentType, SVGProps } from 'react';
export interface MenuItem { id: string; name: string; icon: ComponentType<SVGProps<SVGSVGElement>>; path?: string; children?: MenuItem[] }
export interface CoreEnvironment { apiBase: string; fetch: (url: string, init?: RequestInit) => Promise<Response>; notify: (message: string, kind: 'success' | 'error') => void; basePath: string; portalContainer: HTMLElement; navigate?: (path: string) => void }
export interface App { name: string; title?: string; status: string }
export interface Attachment { id: string; name: string; relativePath: string; sha256: string }
export interface RecordData { id: string; path: string; fields: Record<string, unknown>; content: string; revision: string; attachments: Attachment[]; writable?: boolean }
export interface CollectionData { id: string; title: string; path: string; parameters: string[]; capabilities?: { create: boolean; edit: boolean; delete: boolean } }
export interface Envelope<T> { success: boolean; data: T; code?: string; message?: string; extra?: { total: number; pageNum: number; pageSize: number; writable?: boolean } }
export const operations = [
  ['GET', '/apps', 'read'], ['GET', '/collections', 'read'], ['GET', '/records', 'read'], ['GET', '/record', 'read'], ['GET', '/document', 'read'], ['GET', '/attachment', 'read'],
  ['POST', '/record', 'write'], ['PUT', '/record', 'write'], ['DELETE', '/record', 'write'],
  ['GET', '/settings', 'manage'], ['POST', '/initialize', 'manage'], ['GET', '/configuration', 'manage'], ['PUT', '/configuration', 'manage'],
] as const;
export type OperationCategory = typeof operations[number][2];
