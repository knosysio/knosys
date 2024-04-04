import { defineConfig } from 'umi';

import routes from './src/entry/routes';

let appConfig;
let title;

if (process.env.KNOSYS_APP_PATH) {
  appConfig = require(`${decodeURIComponent(process.env.KNOSYS_APP_PATH!)}/app.json`);
  title = appConfig.title;
} else {
  appConfig = null;
  title = require('@knosys/sdk/src/app').DEFAULT_APP_TITLE;
}

export default defineConfig({
  title,
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
