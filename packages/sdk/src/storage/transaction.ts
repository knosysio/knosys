import { existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, lstatSync } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { atomicWrite, hash, jsonBytes, readJson, removeFile, isWithin, canonical } from './files';
import { fail } from './contracts';

export interface Mutation { file: string; bytes: Buffer | null }
interface Entry { file: string; previous: string | null; next: string | null; previousHash: string | null; nextHash: string | null }
interface Journal { schemaVersion: 1; state: 'prepared' | 'committed'; source: string; entries: Entry[]; createdDirectories: string[]; removedDirectories: string[] }
function apply(journal: Journal, forward: boolean, source: string, appsRoot: string): void {
  if (journal.schemaVersion !== 1 || journal.source !== source || !Array.isArray(journal.entries)) fail(503, 'RECOVERY_FAILED', 'Invalid transaction journal');
  for (const entry of journal.entries) {
    const target: string = canonical(entry.file);
    if (!isWithin(source, target)) {
      if (path.basename(target) !== 'db.json') fail(503, 'RECOVERY_FAILED', 'Transaction target is outside authorized roots');
      const registrationFile: string = path.join(path.dirname(target), 'app.json');
      if (!existsSync(registrationFile)) continue;
      const registration = readJson<{ source?: string }>(registrationFile);
      if (!registration.source || canonical(registration.source) !== source) fail(503, 'RECOVERY_FAILED', 'Transaction index binding changed');
    }
    for (const key of ['previous', 'next'] as const) {
      const bytes: string | null = entry[key];
      if ((bytes === null ? null : hash(Buffer.from(bytes, 'base64'))) !== entry[key === 'previous' ? 'previousHash' : 'nextHash']) fail(503, 'RECOVERY_FAILED', 'Missing or corrupt recovery material');
    }
    const current: string | null = existsSync(entry.file) ? hash(readFileSync(entry.file)) : null;
    if (current !== entry.previousHash && current !== entry.nextHash) fail(503, 'RECOVERY_FAILED', 'Transaction file was changed outside the writer protocol');
    const content: string | null = forward ? entry.next : entry.previous;
    if (content === null) removeFile(entry.file); else atomicWrite(entry.file, Buffer.from(content, 'base64'));
  }
}
function removeEmptyDirectories(source: string, directories: string[]): void {
  for (const directory of [...new Set(directories)].sort((a: string, b: string): number => b.length - a.length)) {
    if (directory === source || !isWithin(source, canonical(directory))) fail(503, 'RECOVERY_FAILED', 'Invalid directory recovery target');
    if (existsSync(directory) && lstatSync(directory).isDirectory() && readdirSync(directory).length === 0) rmdirSync(directory);
  }
}
export function recoverTransactions(source: string, appsRoot: string): void {
  const root: string = path.join(source, '.knosys/transactions');
  if (!isWithin(source, canonical(root))) fail(503, 'RECOVERY_FAILED', 'Recovery directory escapes source');
  if (!existsSync(root)) return;
  for (const name of readdirSync(root).sort()) {
    if (!name.endsWith('.json')) fail(503, 'RECOVERY_FAILED', 'Unexpected recovery material');
    const file: string = path.join(root, name);
    const journal: Journal = readJson<Journal>(file);
    apply(journal, journal.state === 'committed', source, appsRoot);
    removeFile(file);
    removeEmptyDirectories(source, journal.state === 'committed' ? journal.removedDirectories || [] : journal.createdDirectories || []);
  }
}
export function transact(source: string, appsRoot: string, mutations: Mutation[], fault?: (stage: string) => void, removedDirectories: string[] = []): void {
  if (!isWithin(source, canonical(path.join(source, '.knosys')))) fail(403, 'PATH_ESCAPE', 'Transaction directory escapes source');
  const entries: Entry[] = mutations.map((mutation: Mutation): Entry => {
    const previous: Buffer | null = existsSync(mutation.file) ? readFileSync(mutation.file) : null;
    return { file: mutation.file, previous: previous?.toString('base64') ?? null, next: mutation.bytes?.toString('base64') ?? null, previousHash: previous ? hash(previous) : null, nextHash: mutation.bytes ? hash(mutation.bytes) : null };
  });
  if (new Set(entries.map((entry: Entry): string => entry.file)).size !== entries.length) fail(503, 'TRANSACTION_INVALID', 'Duplicate transaction targets');
  const createdDirectories: string[] = [];
  for (const entry of entries) {
    let directory: string = path.dirname(entry.file);
    while (!existsSync(directory) && isWithin(source, directory) && directory !== source) { createdDirectories.push(directory); directory = path.dirname(directory); }
  }
  const journal: Journal = { schemaVersion: 1, state: 'prepared', source, entries, createdDirectories, removedDirectories };
  const file: string = path.join(source, '.knosys/transactions', randomBytes(16).toString('hex') + '.json');
  atomicWrite(file, jsonBytes(journal));
  fault?.('prepared');
  atomicWrite(file, jsonBytes({ ...journal, state: 'committed' }));
  fault?.('committed');
  for (let index: number = 0; index < entries.length; index++) {
    apply({ ...journal, entries: [entries[index]] }, true, source, appsRoot);
    fault?.('file:' + index);
  }
  fault?.('complete');
  removeFile(file);
  removeEmptyDirectories(source, removedDirectories);
}
