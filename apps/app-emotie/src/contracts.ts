export interface KnosysApp { name: string; title?: string; status: string }
export interface KnosysRecord { id: string; content: string; fields: Record<string, unknown>; revision: string }
export interface KnosysSettings { storageRoot: string; allowedRoots: string[]; format: 'QiiDB' }
