import { useContext, useState, useEffect } from 'react';
import { useRouteProps, useParams, history } from 'umi';
import { message } from 'antd';

import LayoutContext from '@/shared/contexts/layout';
import ViewWrapper from '@/shared/components/control/view-wrapper';

import { getOne } from '../../repository';

import ArticleViewWidget from './ArticleViewWidget';

export default function QiiDetail() {
  const { setPage, setHeaderActions } = useContext(LayoutContext);

  const [loading, setLoading] = useState(false);
  const [entity, setEntity] = useState(null);

  const { meta, path } = useRouteProps();
  const { id } = useParams();

  useEffect(() => {
    setHeaderActions([{
      text: '编辑',
      execute: () => history.push(`${path.replace(':id', id)}/edit`),
      primary: true
    }]);
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
      .finally(() => setLoading(false));

    return () => setHeaderActions([])
  }, [meta.collection, id]);

  return (
    <ViewWrapper loading={loading}>
      { entity ? <ArticleViewWidget dataSource={entity} /> : null }
    </ViewWrapper>
  );
}
