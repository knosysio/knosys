import { defineConfig } from 'umi';

import routes from './src/entry/routes';

const appConfig = require(`${decodeURIComponent(process.env.KNOSYS_APP_PATH!)}/app.json`);

export default defineConfig({
  title: appConfig.title,
  define: { 'process.env.KNOSYS_APP': appConfig },
  npmClient: 'npm',
  conventionLayout: false,
  routes,
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8001',
      changeOrigin: true,
    },
  },
  // chainWebpack: memo => {
  //   memo.module.rule('json').test(/\.json$/).type('json');
  // },
});
