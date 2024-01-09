import { useState, useEffect } from 'react';
import axios from 'axios';
import { useRouteProps, useParams } from 'umi';

export default function Qii() {
  const [fetched, setFetched] = useState(false);
  const [entity, setEntity] = useState(null);

  const { meta } = useRouteProps();
  const { id } = useParams();

  useEffect(() => {
    if (fetched) {
      return;
    }

    axios.get('/api/qii/get', {
      headers: { 'X-Knosys-App': (process.env.KNOSYS_APP as any).name },
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
