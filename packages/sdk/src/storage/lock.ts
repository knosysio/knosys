import { existsSync, mkdirSync, rmdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir, hostname } from 'os';
import path from 'path';
import { canonical, hash } from './files';
import { fail } from './contracts';

interface Owner { pid: number; host: string; key: string }
function location(root: string): string { return path.join(tmpdir(), 'knosys-locks-' + (process.getuid ? process.getuid() : 'user'), hash(canonical(root))); }
export async function withLock<T>(root: string, operation: () => T | Promise<T>): Promise<T> {
  const directory: string = location(root);
  mkdirSync(path.dirname(directory), { recursive: true, mode: 0o700 });
  let acquired: boolean = false;
  for (let attempt: number = 0; attempt < 100; attempt++) {
    try { mkdirSync(directory, { mode: 0o700 }); acquired = true; break; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; await new Promise<void>((resolve): void => { setTimeout(resolve, 20); }); }
  }
  if (!acquired) fail(409, 'SOURCE_LOCKED', 'Source is locked; stop the writer and explicitly recover an abandoned local lock');
  try {
    writeFileSync(path.join(directory, 'owner.json'), JSON.stringify({ pid: process.pid, host: hostname(), key: canonical(root) }));
    return await operation();
  } finally { unlinkSync(path.join(directory, 'owner.json')); rmdirSync(directory); }
}
export function recoverLock(root: string): void {
  const directory: string = location(root);
  if (!existsSync(directory)) return;
  const owner: Owner = JSON.parse(readFileSync(path.join(directory, 'owner.json'), 'utf8'));
  if (owner.host !== hostname() || owner.key !== canonical(root) || !Number.isInteger(owner.pid) || owner.pid < 1) fail(409, 'LOCK_OWNER_UNKNOWN', 'Cannot verify the lock owner');
  try { process.kill(owner.pid, 0); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') fail(409, 'LOCK_OWNER_UNKNOWN', 'Cannot verify that the writer exited');
    unlinkSync(path.join(directory, 'owner.json')); rmdirSync(directory); return;
  }
  fail(409, 'WRITER_ACTIVE', 'The writer is still active');
}
