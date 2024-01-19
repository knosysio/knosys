import { useContext, useState, useEffect } from 'react';
import { useRouteProps, useParams } from 'umi';
import { Spin, message } from 'antd';

import LayoutContext from '@/shared/contexts/layout';

import { getOne } from '../../repository';

import EditorViewWidget from './EditorViewWidget';
import style from './style.scss';

export default function QiiForm() {
  const { setPage } = useContext(LayoutContext);

  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [entity, setEntity] = useState(null);

  const { meta } = useRouteProps();
  const { id } = useParams();

  useEffect(() => {
    if (loading || fetched) {
      return;
    }

    setLoading(true);
    getOne({ collection: meta.collection, id })
      .then(res => {
        if (res.success) {
          setPage(res.data);
          setEntity(res.data);
        } else {
          message.error(res.message);
        }
      })
      .finally(() => {
        setFetched(true);
        setLoading(false);
      });
  });

  return (
    <div className={style.QiiForm}>
      <Spin size="large" spinning={loading}>
        { entity ? <EditorViewWidget dataSource={entity} /> : null }
      </Spin>
    </div>
  );
}
