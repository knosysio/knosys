import { LOCAL_DIR_NAME, getConfig, resolvePathFromRootRelative, resolveRootPath } from '@knosys/sdk';
import { DEFAULT_SITE_NAME, DEFAULT_SSG_TYPE } from '@knosys/sdk/site';
import { generateJekyllData } from '@knosys/sdk/site/generators/jekyll';
import { generateHexoData } from '@knosys/sdk/site/generators/hexo';
interface Configuration { generator?: string; source?: string; data?: string | Record<string, string> }
export function execute(...parameters: string[]): void {
  const [site = DEFAULT_SITE_NAME, sourceKey = 'default']: string[] = parameters;
  const root: string = resolveRootPath(process.cwd()) || process.cwd();
  const config: Configuration = getConfig('site.' + site, root) || {};
  const generator: string = config.generator || DEFAULT_SSG_TYPE;
  const data: string | undefined = typeof config.data === 'string' ? config.data : config.data?.[sourceKey];
  const source: string | undefined = resolvePathFromRootRelative(config.source || `./${LOCAL_DIR_NAME}/sites/${site}`, root);
  const dataRoot: string | undefined = data ? resolvePathFromRootRelative(data, root) : undefined;
  if (!source || !dataRoot) throw new Error('Site source and data must be configured in an explicit project');
  if (generator === 'jekyll') generateJekyllData(source, dataRoot, sourceKey);
  else if (generator === 'hexo') generateHexoData(source, dataRoot, sourceKey);
  else throw new Error('Unknown site generator: ' + generator);
}
export default { execute };
