import httpClient from '@/shared/utils/http';

import type { AppConfig } from './typing';

function getList() {
  return httpClient.get<AppConfig[]>('/app/list')
}

function getOne() {
  return httpClient.get<AppConfig>('/app/one');
}

function updateOne(config: Partial<AppConfig>) {
  return httpClient.put('/app/one', config);
}

export { getList, getOne, updateOne };
