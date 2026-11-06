import { existsSync } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';
import { defineRouter, type ServerContext, type ServerExtension, type RouterLayer } from '@emotie/extension-sdk/server';
import { createKnosysRouter, categoryFor } from '@knosys/web-core/server';
export function createServerExtension(context: ServerContext): ServerExtension {
  const knosys: string = path.join(homedir(), '.knosys');
  const appsRoot: string = path.resolve(process.env.KNOSYS_APPS_ROOT || (existsSync(knosys) ? path.join(knosys, 'apps') : path.join(homedir(), '.emotie/apps/knosys')));
  const roots: unknown = process.env.KNOSYS_ALLOWED_ROOTS !== undefined ? JSON.parse(process.env.KNOSYS_ALLOWED_ROOTS) : [appsRoot, process.cwd()];
  if (!Array.isArray(roots) || !roots.every((root: unknown): boolean => typeof root === 'string' && path.isAbsolute(root))) throw new Error('KNOSYS_ALLOWED_ROOTS must contain absolute paths');
  const router = createKnosysRouter({ appsRoot, allowedRoots: roots as string[], managedRoots: [path.join(homedir(), '.emotie/apps'), path.join(context.paths.repositoryDirectory, '.emotie/cache/apps')], allowManagedRegistration: true, isAdministrator: (ctx): boolean => (ctx.state.persona?.administrator === true || ctx.state.accessContext?.administrator === true), authorize: (ctx, category): boolean => category !== 'manage' || (ctx.state.persona?.administrator === true || ctx.state.accessContext?.administrator === true) });
  return { routes: defineRouter(router as unknown as { stack: RouterLayer[] }, (method: string, pathname: string) => ({ access: categoryFor(method, pathname) === 'manage' ? 'administrator' : 'session' })) };
}
