import { useState, useEffect } from 'react'
import { ConfigProvider, Spin, message } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';

import { cacheAppName, getCachedAppName } from '@/shared/utils/cache';
import httpClient from '@/shared/utils/http';

import DefaultLayout from './DefaultLayout';

function getAppList() {
  return httpClient.get('/app/query')
}

function resolveCurrentApp(apps) {
  const cachedApp = getCachedAppName();

  let currentApp;

  if (cachedApp) {
    currentApp = apps.find(({ name }) => name === cachedApp);
  }

  if (!currentApp) {
    currentApp = apps[0];
  }

  return currentApp;
}

export default function AppLayout() {
  const [loading, setLoading] = useState(false);
  const [app, setApp] = useState(null);

  useEffect(() => {
    if (!app && !loading) {
      setLoading(true);
      getAppList()
        .then(res => {
          if (res.success) {
            const currentApp = resolveCurrentApp(res.data);

            if (currentApp) {
              cacheAppName(currentApp.name);
              setApp(currentApp);
            } else {
              message.warning('没有已初始化的应用');
            }
          } else {
            message.error(res.message);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [app]);

  return (
    <ConfigProvider locale={zhCN} autoInsertSpaceInButton={false}>
      <Spin size="large" spinning={loading}>
        {app ? <DefaultLayout app={app} /> : null}
      </Spin>
    </ConfigProvider>
  );
}
