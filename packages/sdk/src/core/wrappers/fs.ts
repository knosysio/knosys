import { copyFileSync, renameSync, mkdirSync, openSync, closeSync, existsSync, lstatSync, readdirSync, rmdirSync, unlinkSync } from 'fs';
import path from 'path';

export function cp(fromPath: string, toPath: string): void { copyFileSync(fromPath, toPath); }
export function rm(fileOrDirPath: string): void {
  if (!existsSync(fileOrDirPath)) return;
  if (lstatSync(fileOrDirPath).isDirectory()) {
    for (const name of readdirSync(fileOrDirPath)) rm(path.join(fileOrDirPath, name));
    rmdirSync(fileOrDirPath);
  } else unlinkSync(fileOrDirPath);
}
export function mv(from: string, to: string): void { renameSync(from, to); }
export function mkdir(dirPath: string): void { mkdirSync(dirPath, { recursive: true }); }
export function touch(filePath: string): void { closeSync(openSync(filePath, 'a')); }
