import httpClient from '@/shared/utils/http';

import type { ListRequestParams, ObjectRequestParams } from './typing';

function getList(params: ListRequestParams) {
  return httpClient.get('/qii/query', { params });
}

function getOne(params: ObjectRequestParams) {
  return httpClient.get('/qii/get', { params });
}

function deleteOne(params: ObjectRequestParams) {
  return httpClient.delete('/qii/remove', { params });
}

export { getList, getOne, deleteOne };
