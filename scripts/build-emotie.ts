import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
const root: string = path.resolve(import.meta.dirname, '..');
const directory: string = path.join(root, 'apps/app-emotie');
execFileSync('pnpm', ['exec', 'tsc'], { cwd: directory, stdio: 'inherit' });
for (const kind of ['server', 'web', 'contracts']) {
  await build({ entryPoints: [path.join(directory, 'src', kind + (kind === 'web' ? '.tsx' : '.ts'))], outfile: path.join(directory, 'dist', kind + '.js'), bundle: true, platform: kind === 'web' ? 'browser' : 'node', format: 'esm', target: kind === 'web' ? 'es2022' : 'node24', external: kind === 'web' ? ['react', 'react/*', 'react-dom', 'react-dom/*', 'react-router-dom', '@heroui/react', '@emotie/ui/auth/session', '@emotie/ui/toast'] : [], banner: kind === 'server' ? { js: "import{createRequire as __createRequire}from'node:module';const require=__createRequire(import.meta.url);" } : undefined, define: kind === 'web' ? { 'process.env.NODE_ENV': '"production"' } : {} });
}
const compiler = await compile('@reference "tailwindcss"; @tailwind utilities;', { base: directory, onDependency: (): void => {} });
const scanner = new Scanner({ sources: [{ base: path.join(root, 'packages/web-core/src/browser'), pattern: '**/*.{ts,tsx}', negated: false }, { base: path.join(directory, 'src'), pattern: '**/*.{ts,tsx}', negated: false }] });
writeFileSync(path.join(directory, 'dist/style.css'), compiler.build(scanner.scan()) + '\n' + readFileSync(path.join(root, 'packages/web-core/src/browser/style.css'), 'utf8'));
const webFile: string = path.join(directory, 'dist/web.js'); writeFileSync(webFile, "import './style.css';\n" + readFileSync(webFile, 'utf8'));

copyFileSync(path.join(root, 'packages/sdk/dist/THIRD-PARTY-NOTICES.md'), path.join(directory, 'dist/THIRD-PARTY-NOTICES.md'));
