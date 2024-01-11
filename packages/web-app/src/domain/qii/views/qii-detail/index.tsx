import { useState, useEffect } from 'react';
import { useRouteProps, useParams } from 'umi';
import { message } from 'antd';

import { getOne } from '../../repository';

export default function QiiDetail() {
  const [fetched, setFetched] = useState(false);
  const [entity, setEntity] = useState(null);

  const { meta } = useRouteProps();
  const { id } = useParams();

  useEffect(() => {
    if (fetched) {
      return;
    }

    getOne({ collection: meta.collection, id })
      .then(res => res.success ? setEntity(res.data) : message.error(res.message))
      .finally(() => setFetched(true));
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
