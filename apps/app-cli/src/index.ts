import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { spawn } from 'child_process';
import { getConfig, resolveRootPath } from '@knosys/sdk';
import { planMigration, applyMigration, verifyMigration, recoverLock, type MigrationPlan, type MigrationReport, type MigrationMapping } from '@knosys/sdk/app';
import siteCommand from './commands/site.js';
import generateCommand from './commands/generate.js';

type Command = { execute: (...parameters: string[]) => unknown };

export async function execute(...args: string[]): Promise<void> {
  const [command, ...parameters]: string[] = args.length ? args : process.argv.slice(2);
  if (!command) throw new Error('Usage: ksio <app|site|generate|migrate>');
  const root: string = resolveRootPath(process.cwd()) || process.cwd();
  const config: unknown = getConfig('command', root);
  const custom: unknown = typeof config === 'string' ? path.join(config, command + '.js') : config && typeof config === 'object' ? (config as Record<string, unknown>)[command] : undefined;
  if (typeof custom === 'string') {
    const script: string = path.resolve(root, custom);
    const candidates: string[] = [script, script + '.js', path.join(script.replace(/\.js$/, ''), 'index.js')];
    const selected: string | undefined = candidates.find((candidate: string): boolean => existsSync(candidate));
    if (selected) {
      const loaded = await import(pathToFileURL(selected).href);
      const implementation: Command = loaded.execute ? loaded : loaded.default;
      if (typeof implementation?.execute !== 'function') throw new Error('Custom command must export execute');
      await implementation.execute(...parameters);
      return;
    }
  }
  if (command === 'generate') { await generateCommand.execute(...parameters); return; }
  if (command === 'site') { await siteCommand.execute(...parameters); return; }
  if (command === 'app') {
    if (parameters[0] && parameters[0] !== 'serve') throw new Error('Usage: ksio app serve [--web-path <built-web-directory>]');
    if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('ksio app serve requires Node.js 24; use Node.js 24 before loading the Web server');
    const flag: number = parameters.indexOf('--web-path');
    if (flag >= 0 && !parameters[flag + 1]) throw new Error('--web-path requires a built Web directory');
    const directory: string = flag >= 0 ? path.resolve(parameters[flag + 1]) : path.resolve(__dirname, '../../app-web');
    const server: string = path.join(directory, 'dist/server.mjs');
    if (!existsSync(server)) throw new Error('Built Web server missing; build app-web or provide --web-path <distribution>');
    await new Promise<void>((resolve, reject): void => {
      const child = spawn(process.execPath, [server], { stdio: 'inherit', cwd: root });
      child.on('error', reject);
      child.on('exit', (code: number | null): void => code === 0 ? resolve() : reject(new Error('Web server exited with code ' + code)));
    });
    return;
  }
  if (command === 'migrate') {
    const option = (name: string): string => { const index: number = parameters.indexOf('--' + name); if (index < 0 || !parameters[index + 1]) throw new Error('Missing --' + name); return parameters[index + 1]; };
    if (parameters[0] === 'plan') {
      const mappingFlag: number = parameters.indexOf('--mapping');
      const mapping: MigrationMapping[] = mappingFlag < 0 ? [] : JSON.parse(readFileSync(option('mapping'), 'utf8'));
      const plan: MigrationPlan = await planMigration(option('source'), option('target'), mapping);
      const output: string = parameters.includes('--output') ? option('output') : path.resolve(option('target') + '.plan.json'); writeFileSync(output, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
      console.info(output); if (plan.blockers.length) throw new Error('Migration plan has blockers: ' + plan.blockers.join('; '));
      return;
    }
    if (parameters[0] === 'apply') { if (!parameters.includes('--old-writers-stopped')) throw new Error('Stop all legacy writers and pass --old-writers-stopped'); const report: MigrationReport = await applyMigration(JSON.parse(readFileSync(option('plan'), 'utf8'))); console.info(JSON.stringify(report)); return; }
    if (parameters[0] === 'verify') { console.info(JSON.stringify(verifyMigration(JSON.parse(readFileSync(option('report'), 'utf8'))))); return; }
    throw new Error('Usage: ksio migrate <plan|apply|verify>');
  }
  if (command === 'recover-lock') { if (!parameters[0]) throw new Error('Usage: ksio recover-lock <source>'); recoverLock(path.resolve(parameters[0])); return; }
  throw new Error('Unknown command: ' + command);
}
