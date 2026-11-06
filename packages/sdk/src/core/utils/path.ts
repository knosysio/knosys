/**
 * Resolve path from parameters
 */
export function resolvePathFromParams(paramPath: string, params: Record<string, string>): string {
  return paramPath.split('/').map(part => params[part]).join('/');
}
