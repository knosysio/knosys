import httpClient from '@/shared/utils/http';

function getList(params: { collection: string; pageSize?: number; pageNum?: number; }) {
  return httpClient.get('/api/qii/query', { params });
}

function getOne(params: { collection: string; id?: string; }) {
  return httpClient.get('/api/qii/get', { params });
}

export { getList, getOne };
