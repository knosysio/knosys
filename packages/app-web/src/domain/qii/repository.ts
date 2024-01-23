import httpClient from '@/shared/utils/http';

import type { ListRequestParams, ObjectRequestParams } from './typing';

function getList(params: ListRequestParams) {
  return httpClient.get('/qii/list', { params });
}

function getOne(params: ObjectRequestParams) {
  return httpClient.get('/qii/one', { params });
}

function deleteOne(params: ObjectRequestParams) {
  return httpClient.delete('/qii/one', { params });
}

export { getList, getOne, deleteOne };
