interface RequestParams {
  collection: string;
}

interface ListRequestParams extends RequestParams {
  pageSize?: number;
  pageNum?: number;
}

interface ObjectRequestParams extends RequestParams {
  id?: string;
}

export type { ListRequestParams, ObjectRequestParams };
