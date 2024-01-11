import httpClient from '@/shared/utils/http';

function getList(params: { collection: string; pageSize?: number; pageNum?: number; }) {
  return httpClient.get('/qii/query', { params });
}

function getOne(params: { collection: string; id?: string; }) {
  return httpClient.get('/qii/get', { params });
}

function deleteOne(params: { collection: string; id?: string; }) {
  return httpClient.delete('/qii/remove', { params });
}

export { getList, getOne, deleteOne };
