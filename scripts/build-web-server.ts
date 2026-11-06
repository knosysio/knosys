import { build } from 'esbuild';
import path from 'node:path';
const root: string = path.resolve(import.meta.dirname, '..');
await build({ entryPoints: [path.join(root, 'apps/app-web/server/index.ts')], outfile: path.join(root, 'apps/app-web/dist/server.mjs'), bundle: true, platform: 'node', target: 'node24', format: 'esm', banner: { js: "import{createRequire as __createRequire}from'node:module';const require=__createRequire(import.meta.url);" } });
