import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, readdirSync, openSync, closeSync, fsyncSync, writeFileSync, renameSync, unlinkSync } from 'fs';
import path from 'path';
import { createHash, randomBytes } from 'crypto';
import { fail } from './contracts';

export function hash(bytes: Buffer | string): string { return createHash('sha256').update(bytes).digest('hex'); }
export function identifier(namespace: string): string { return hash(namespace).slice(0, 32); }
export function isWithin(root: string, target: string): boolean { const relative: string = path.relative(root, target); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); }
export function canonical(target: string): string {
  const absolute: string = path.resolve(target);
  if (existsSync(absolute)) return realpathSync(absolute);
  const parent: string = path.dirname(absolute);
  if (parent === absolute) return absolute;
  return path.join(canonical(parent), path.basename(absolute));
}
export function segments(relative: string, allowHidden: boolean = false, allowEncoded: boolean = false): string[] {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || /[\\\0]/.test(relative) || /^[a-zA-Z]:/.test(relative) || (!allowEncoded && /%(?:2f|5c|00|25|2e)/i.test(relative))) fail(400, 'INVALID_PATH', 'Invalid relative path');
  const parts: string[] = relative.split('/');
  if (parts.some((part: string): boolean => !part || part === '.' || part === '..' || (part.startsWith('.') && !allowHidden))) fail(400, 'INVALID_PATH', 'Invalid path segment');
  return parts;
}
export function contained(root: string, relative: string): string {
  const target: string = path.join(root, ...segments(relative, true, true));
  if (!isWithin(root, canonical(target))) fail(403, 'PATH_ESCAPE', 'Path escapes its authorized root');
  return target;
}
export function readJson<T>(file: string, fallback?: T): T {
  if (!existsSync(file) && fallback !== undefined) return fallback;
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}
export function atomicWrite(file: string, bytes: Buffer | string): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary: string = file + '.' + randomBytes(12).toString('hex') + '.tmp';
  const descriptor: number = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
  renameSync(temporary, file);
  const parent: number = openSync(path.dirname(file), 'r');
  try { fsyncSync(parent); } finally { closeSync(parent); }
}
export function jsonBytes(value: unknown): Buffer { return Buffer.from(JSON.stringify(value, null, 2) + '\n'); }
export function walk(root: string, includeHidden: boolean = false): string[] {
  const files: string[] = [];
  const visit = (relative: string): void => {
    for (const name of readdirSync(path.join(root, relative)).sort()) {
      if (!includeHidden && name.startsWith('.') && name !== '.meta') continue;
      const file: string = path.join(root, relative, name);
      const info = lstatSync(file);
      if (info.isSymbolicLink()) fail(403, 'SYMLINK_UNSUPPORTED', 'Entity symlinks require explicit migration');
      if (info.isDirectory()) visit(path.join(relative, name));
      else if (info.isFile()) files.push(path.join(relative, name).split(path.sep).join('/'));
      else fail(503, 'UNSUPPORTED_FILE', 'Source contains a special file');
    }
  };
  visit('');
  return files;
}
export function removeFile(file: string): void { if (existsSync(file)) unlinkSync(file); }
