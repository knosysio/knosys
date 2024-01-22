import { useContext, useState, useEffect } from 'react';
import { useRouteProps, useParams, history } from 'umi';
import { message } from 'antd';

import LayoutContext from '@/shared/contexts/layout';
import ViewWrapper from '@/shared/components/control/view-wrapper';

import { getOne } from '../../repository';

import EditorViewWidget from './EditorViewWidget';

export default function QiiForm() {
  const { setPage, setHeaderActions } = useContext(LayoutContext);

  const [loading, setLoading] = useState(false);
  const [entity, setEntity] = useState(null);

  const { meta, path } = useRouteProps();
  const { id } = useParams();

  useEffect(() => {
    setHeaderActions([{
      text: '保存',
      execute: () => history.push(`${path.replace(':id/edit', id)}`),
      primary: true
    }]);

    if (id) {
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
    } else {
      setPage({ title: '新建' });
      setEntity({} as any);
    }

    return () => setHeaderActions([])
  }, [meta.collection, id]);

  return (
    <ViewWrapper loading={loading}>
      { entity ? <EditorViewWidget dataSource={entity} /> : null }
    </ViewWrapper>
  );
}
