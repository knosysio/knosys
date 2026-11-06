import { build } from 'esbuild';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const require = createRequire(import.meta.url);
const root: string = path.resolve(import.meta.dirname, '../packages/sdk');
const bundled: Set<string> = new Set();
const entries: string[] = ['index', 'app/index', 'site/index', 'site/generators/jekyll', 'site/generators/hexo'];
rmSync(path.join(root, 'dist'), { recursive: true, force: true });
execFileSync('pnpm', ['exec', 'tsc'], { cwd: root, stdio: 'inherit' });
for (const entry of entries) {
  const input: string = path.join(root, 'src', entry + (entry.includes('generators') ? '.cjs' : '.ts'));
  const outfile: string = path.join(root, 'dist', entry + '.cjs');
  const result = await build({ metafile: true, entryPoints: [input], outfile, bundle: true, platform: 'node', target: 'node14', format: 'cjs', legalComments: 'eof' });
  for (const input of Object.keys(result.metafile!.inputs)) {
    if (!input.includes('node_modules/')) continue;
    let directory: string = path.dirname(path.resolve(root, input));
    while (!existsSync(path.join(directory, 'package.json')) && directory !== path.dirname(directory)) directory = path.dirname(directory);
    if (existsSync(path.join(directory, 'package.json'))) bundled.add(directory);
  }
  if (entry.includes('generators')) copyFileSync(path.join(root, 'dist', entry + '.d.cts'), path.join(root, 'dist', entry + '.d.ts'));
  const names: string[] = Object.keys(require(outfile)).filter((key: string): boolean => key !== 'default');
  writeFileSync(path.join(root, 'dist', entry + '.mjs'), `import implementation from './${path.basename(entry)}.cjs';\nexport default implementation.default || implementation;\n` + names.map((name: string): string => `export const ${name} = implementation.${name};`).join('\n') + '\n');
}
const notices: string[] = [];
for (const directory of [...bundled].sort()) {
  const pkg = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  notices.push(`## ${pkg.name}@${pkg.version} (${pkg.license})`);
  const licenses: string[] = readdirSync(directory).filter((name: string): boolean => /^(licen[sc]e|copying|notice)(\.|$)/i.test(name));
  if (!licenses.length) { const fallback: string = path.join(root, 'licenses', pkg.name.replace('@', '').replace('/', '-') + '-LICENSE'); if (!existsSync(fallback)) throw new Error('Bundled dependency license missing: ' + pkg.name); notices.push(readFileSync(fallback, 'utf8')); }
  for (const file of licenses) notices.push(readFileSync(path.join(directory, file), 'utf8'));
}
writeFileSync(path.join(root, 'dist/THIRD-PARTY-NOTICES.md'), '# Bundled dependencies\n\n' + notices.join('\n\n') + '\n');

const declarations = (directory: string): void => {
  for (const name of readdirSync(directory, { withFileTypes: true })) {
    if (name.name === 'types-cjs') continue;
    const file: string = path.join(directory, name.name);
    if (name.isDirectory()) { declarations(file); continue; }
    if (!name.name.endsWith('.d.ts')) continue;
    const original: string = readFileSync(file, 'utf8');
    const rewrite = (extension: string): string => original.replace(/(from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g, (_match: string, before: string, value: string, after: string): string => {
      const target: string = path.resolve(directory, value);
      const suffix: string = existsSync(target + '.d.ts') ? extension : existsSync(path.join(target, 'index.d.ts')) ? '/index' + extension : '';
      return before + value + suffix + after;
    });
    writeFileSync(file, rewrite('.js'));
    const common: string = path.join(root, 'dist/types-cjs', path.relative(path.join(root, 'dist'), file).replace(/\.d\.ts$/, '.d.cts'));
    mkdirSync(path.dirname(common), { recursive: true }); writeFileSync(common, rewrite('.cjs'));
  }
};
declarations(path.join(root, 'dist'));
