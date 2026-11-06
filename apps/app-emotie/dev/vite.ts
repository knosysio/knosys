import path from 'node:path';
import type { Server } from 'node:http';
import type { InlineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export function developmentConfig(port: number, apiPort: number, httpServer: Server): InlineConfig {
  const root: string = path.resolve(import.meta.dirname, '../../..');
  return {
    configFile: false,
    root: import.meta.dirname,
    plugins: [react(), tailwindcss()],
    resolve: { dedupe: ['react', 'react-dom', 'react-router-dom', '@heroui/react'], alias: [{ find: /^@knosys\/web-core\/browser$/, replacement: path.join(root, 'packages/web-core/src/browser/index.tsx') }, { find: /^@knosys\/web-core\/contracts$/, replacement: path.join(root, 'packages/web-core/src/contracts/index.ts') }] },
    optimizeDeps: { include: ['react', 'react-dom/client', 'react-router-dom', '@heroui/react', '@heroicons/react/24/outline'] },
    server: { middlewareMode: true, hmr: { server: httpServer }, host: '127.0.0.1', port, strictPort: true, allowedHosts: ['localhost', '127.0.0.1'], fs: { strict: true, allow: [root], deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.build/**'] }, proxy: { '/api': `http://127.0.0.1:${apiPort}`, '/__knosys_dev': `http://127.0.0.1:${apiPort}` } },
  };
}
