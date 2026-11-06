import { LOCAL_DIR_NAME, getConfig, resolvePathFromRootRelative, resolveRootPath, ensureDirExists } from '@knosys/sdk';
import { DEFAULT_SITE_NAME, DEFAULT_SSG_TYPE, deploySite } from '@knosys/sdk/site';
import { copyJekyllTheme, serveJekyllSite, generateJekyllSite } from '@knosys/sdk/site/generators/jekyll';
import { serveHexoSite, generateHexoSite } from '@knosys/sdk/site/generators/hexo';
interface Configuration { alias?: string; data?: string; generator?: string; source?: string; theme?: string; git?: { url: string; branch?: string }; cname?: string }
export function execute(...parameters: string[]): void {
  const [command, site = DEFAULT_SITE_NAME]: string[] = parameters;
  if (!['copy', 'serve', 'deploy'].includes(command)) throw new Error('Usage: ksio site <copy|serve|deploy> [site]');
  const root: string = resolveRootPath(process.cwd()) || process.cwd();
  const config: Configuration = 'site' in getConfig(undefined, root) ? getConfig('site.' + site, root) || {} : { alias: site, data: '.' };
  const generator: string = config.generator || DEFAULT_SSG_TYPE;
  const source: string | undefined = resolvePathFromRootRelative(config.source || `./${LOCAL_DIR_NAME}/sites/${site}`, root);
  if (!source) throw new Error('Site source must be configured in an explicit project');
  ensureDirExists(source);
  if (command === 'copy') {
    const theme: string | undefined = config.theme ? resolvePathFromRootRelative(config.theme, root) : undefined;
    if (generator !== 'jekyll' || !theme) throw new Error('Theme copying requires a configured Jekyll theme');
    copyJekyllTheme(source, theme); return;
  }
  if (command === 'serve') {
    if (generator === 'jekyll') serveJekyllSite(source); else if (generator === 'hexo') serveHexoSite(source); else throw new Error('Unknown site generator: ' + generator);
    return;
  }
  if (!config.git?.url) throw new Error('Site deployment requires a Git destination');
  const build: ((source: string, destination: string) => void) | undefined = generator === 'jekyll' ? generateJekyllSite : generator === 'hexo' ? generateHexoSite : undefined;
  if (!build) throw new Error('Unknown site generator: ' + generator);
  deploySite(site, config, (destination: string): void => { build(source, destination); });
}
export default { execute };
