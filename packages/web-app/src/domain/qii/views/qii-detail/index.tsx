import { useState, useEffect } from 'react';
import { useRouteProps, useParams } from 'umi';

import httpClient from '@/shared/utils/http';

export default function Qii() {
  const [fetched, setFetched] = useState(false);
  const [entity, setEntity] = useState(null);

  const { meta } = useRouteProps();
  const { id } = useParams();

  useEffect(() => {
    if (fetched) {
      return;
    }

    httpClient.get('/api/qii/get', {
      params: { collection: meta.collection, id }
    }).then(res => {
      setEntity(res.data);
      setFetched(true);
    });
  });

  return (
    <div>{ entity ? (
      <>
        <h3>{ entity.title }</h3>
        <p>{ entity.description }</p>
      </>
    ) : '暂无数据' }</div>
  );
}
