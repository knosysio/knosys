import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, realpathSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Artifact { name: string; version: string; sha256: string; file: string; source: string; manifest?: { id: string; version: string } }
export interface ArtifactLock { schemaVersion: 1; artifacts: Record<string, Artifact> }
export function inspectArchive(bytes: Buffer): Map<string, Buffer> {
  const tar: Buffer = gunzipSync(bytes, { maxOutputLength: 128 * 1024 * 1024 });
  const files: Map<string, Buffer> = new Map();
  let offset: number = 0;
  let pending: string | undefined;
  while (offset + 512 <= tar.length) {
    const header: Buffer = tar.subarray(offset, offset + 512);
    if (header.every((byte: number): boolean => byte === 0)) break;
    const text = (start: number, size: number): string => header.subarray(start, start + size).toString('utf8').replace(/\0.*$/s, '');
    const expected: number = Number.parseInt(text(148, 8).trim(), 8);
    const actual: number = header.reduce((sum: number, byte: number, index: number): number => sum + (index >= 148 && index < 156 ? 32 : byte), 0);
    const size: number = Number.parseInt(text(124, 12).trim(), 8);
    if (expected !== actual || !Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw new Error('Invalid artifact tar header');
    const type: string = text(156, 1);
    const body: Buffer = tar.subarray(offset + 512, offset + 512 + size);
    const prefix: string = text(345, 155);
    let name: string = pending || (prefix ? prefix + '/' : '') + text(0, 100);
    pending = undefined;
    if (type === 'x') {
      const data: string = body.toString('utf8');
      for (const entry of data.split('\n')) {
        const pair: string = entry.slice(entry.indexOf(' ') + 1);
        if (pair.startsWith('path=')) pending = pair.slice(5);
        else if (pair && !/^(mtime|atime|ctime|uid|gid|uname|gname)=/.test(pair)) throw new Error('Unsupported artifact PAX field');
      }
    } else {
      if (!['0', '', '5'].includes(type)) throw new Error('Artifact links and special files are forbidden');
      name = name.replace(/\/$/, '');
      if (!name.startsWith('package/') || /[\\\0]/.test(name) || name.split('/').some((part: string): boolean => !part || part === '..' || part === '.')) throw new Error('Unsafe artifact archive path');
      if (files.has(name)) throw new Error('Duplicate artifact archive path');
      if (type !== '5') files.set(name, Buffer.from(body));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  if (pending || !files.has('package/package.json')) throw new Error('Artifact package manifest missing');
  return files;
}
export function validateArtifact(bytes: Buffer, artifact: Artifact): void {
  if (!/^[a-f0-9]{64}$/.test(artifact.sha256) || createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) throw new Error('Artifact SHA256 mismatch: ' + artifact.name);
  const files: Map<string, Buffer> = inspectArchive(bytes);
  const pkg = JSON.parse(files.get('package/package.json')!.toString());
  if (pkg.name !== artifact.name || pkg.version !== artifact.version) throw new Error('Artifact package identity mismatch: ' + artifact.name);
  for (const section of ['dependencies', 'optionalDependencies', 'peerDependencies']) for (const version of Object.values(pkg[section] || {})) if (typeof version !== 'string' || /^(workspace:|file:|link:)/.test(version)) throw new Error('Artifact contains unresolved local dependency');
  if (artifact.manifest) {
    const manifest = JSON.parse(files.get('package/manifest.json')?.toString() || 'null');
    if (!manifest || manifest.id !== artifact.manifest.id || manifest.version !== artifact.manifest.version) throw new Error('Artifact extension manifest mismatch');
  }
}
export function restoreArtifacts(root: string, from: string): { restored: string[]; npmDependenciesPrewarmed: false } {
  const lock: ArtifactLock = JSON.parse(readFileSync(path.join(root, 'artifact-lock.json'), 'utf8'));
  if (lock.schemaVersion !== 1 || !lock.artifacts || typeof lock.artifacts !== 'object') throw new Error('Invalid artifact lock');
  const source: string = realpathSync(from);
  const checked: { artifact: Artifact; bytes: Buffer }[] = [];
  for (const artifact of Object.values(lock.artifacts)) {
    if (typeof artifact.file !== 'string' || path.basename(artifact.file) !== artifact.file || !artifact.file.endsWith('.tgz') || !artifact.source) throw new Error('Invalid artifact acquisition identifier');
    const input: string = path.join(source, artifact.file);
    if (!realpathSync(input).startsWith(source + path.sep)) throw new Error('Artifact source escapes acquisition directory');
    const bytes: Buffer = readFileSync(input);
    validateArtifact(bytes, artifact);
    checked.push({ artifact, bytes });
  }
  const destination: string = path.join(root, '.build/artifacts');
  mkdirSync(destination, { recursive: true });
  for (const { artifact, bytes } of checked) {
    const target: string = path.join(destination, artifact.file);
    const temporary: string = target + '.' + randomBytes(8).toString('hex') + '.tmp';
    writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o600 }); renameSync(temporary, target);
  }
  return { restored: checked.map(({ artifact }): string => artifact.file), npmDependenciesPrewarmed: false };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flag: number = process.argv.indexOf('--from');
  if (flag < 0 || !process.argv[flag + 1]) throw new Error('Usage: pnpm restore-artifacts --from <artifact-library>');
  console.info(JSON.stringify(restoreArtifacts(path.resolve(import.meta.dirname, '..'), process.argv[flag + 1]), null, 2));
}
