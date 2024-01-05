import { defineConfig } from 'umi';

import routes from './src/entry/routes';

const appTitle = process.env.KNOSYS_APP_TITLE;

export default defineConfig({
  title: appTitle,
  routes,
  define: {
    'process.env.KNOSYS_APP_TITLE': appTitle,
  },
  npmClient: 'npm',
});
