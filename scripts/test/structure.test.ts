import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { renderMarkdown } from '../../packages/web-core/src/browser/markdown.ts';

test('core browser bundle has no Node or Emotie implementation dependency', async (): Promise<void> => {
  const result = await build({ entryPoints: ['packages/web-core/src/browser/index.tsx'], outfile: '.build/core-browser-check.js', bundle: true, platform: 'browser', format: 'esm', write: false, metafile: true, external: ['react', 'react/*', 'react-router-dom', '@heroui/react', '@heroicons/react/*'] });
  assert.equal(Object.keys(result.metafile!.inputs).some((file: string): boolean => file.includes('/sdk/') || file.includes('/server/') || file.includes('@emotie/')), false);
  for (const output of Object.values(result.metafile!.outputs)) assert.equal(output.imports.some((entry): boolean => entry.path.startsWith('node:') || entry.path.startsWith('@emotie/')), false);
});

test('Markdown disables HTML and dangerous protocols and resolves only registered relative attachments', (): void => {
  const html: string = renderMarkdown('<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n![bad](data:text/html,test)\n\n[good](https://example.com)\n\n[local](folder/a.pdf)', [{ id: 'attachment', name: 'a.pdf', relativePath: 'folder/a.pdf', sha256: 'hash' }], (id: string): string => '/api/attachment?id=' + id);
  assert.equal(html.includes('<script>'), false); assert.equal(/href="javascript:|src="data:/.test(html), false); assert.ok(html.includes('href="https://example.com"')); assert.ok(html.includes('href="/api/attachment?id=attachment"'));
});
