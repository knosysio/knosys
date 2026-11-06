import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, existsSync, lstatSync, copyFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root: string = path.resolve(import.meta.dirname, '..');
const argument: number = process.argv.indexOf('--from');
if (argument >= 0 && !process.argv[argument + 1]) throw new Error('--from requires an artifact library');
const library: string = path.resolve(argument >= 0 ? process.argv[argument + 1] : path.join(root, '.build/artifacts'));
const fixture: string = mkdtempSync(path.join(tmpdir(), 'knosys-clean-'));
console.info('Isolated clean source: ' + fixture);
try {
  const files: string[] = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const name of files) {
    const source: string = path.join(root, name); if (!existsSync(source)) continue;
    if (!lstatSync(source).isFile()) throw new Error('Source fixture only accepts regular files: ' + name);
    const target: string = path.join(fixture, name); mkdirSync(path.dirname(target), { recursive: true }); copyFileSync(source, target);
  }
  const tracked: string[] = ['package.json', 'pnpm-lock.yaml', 'artifact-lock.json']; const before: Buffer[] = tracked.map((file: string): Buffer => readFileSync(path.join(fixture, file)));
  for (const [command, args] of [[process.execPath, ['scripts/restore-artifacts.ts', '--from', library]], ['pnpm', ['install', '--offline', '--frozen-lockfile']], ['pnpm', ['build']]] as [string, string[]][]) execFileSync(command, args, { cwd: fixture, stdio: 'inherit' });
  for (const [index, file] of tracked.entries()) if (!before[index].equals(readFileSync(path.join(fixture, file)))) throw new Error('Bootstrap modified tracked configuration: ' + file);
  console.info('PASS clean artifact restoration, offline frozen installation and complete build without adjacent source');
} finally { rmSync(fixture, { recursive: true, force: true }); }
