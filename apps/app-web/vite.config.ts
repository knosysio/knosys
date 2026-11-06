import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [tailwindcss()], server: { host: '127.0.0.1', port: 8002, strictPort: true, proxy: { '/api': { target: 'http://127.0.0.1:8001', changeOrigin: true } } } });
