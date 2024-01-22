import httpClient from '@/shared/utils/http';

import type { AppConfig } from './typing';

function getAppConfig() {
  return httpClient.get<AppConfig>('/app/get');
}

export { getAppConfig };
