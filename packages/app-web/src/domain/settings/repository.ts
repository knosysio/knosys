import httpClient from '@/shared/utils/http';

import type { AppConfig } from './typing';

function getAppConfig() {
  return httpClient.get<AppConfig>('/app/get');
}

function updateAppConfig(config: Partial<AppConfig>) {
  return httpClient.put('/app/update', config);
}

export { getAppConfig, updateAppConfig };
