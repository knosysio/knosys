import { useContext, useState, useEffect } from 'react';
import { useRouteProps, history } from 'umi';
import { message } from 'antd';

import LayoutContext from '@/shared/contexts/layout';
import ViewWrapper from '@/shared/components/control/view-wrapper';

import { resolveBannerUrl } from '../../helper';
import { getList, deleteOne } from '../../repository';

import CardListViewWidget from './CardListViewWidget';
import style from './style.scss';

function resolveListItem<R = Record<string, any>>(record: R): R {
  const cover = record.banner || record.cover;
  const item = {
    id: record.id,
    key: record.path,
    title: record.title || record.path,
    description: record.description,
  } as R;

  if (cover) {
    item.cover = resolveBannerUrl(cover);
  }

  return item;
}

const loadTime = Date.now();

export default function QiiList() {
  const { setHeaderActions } = useContext(LayoutContext);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(loadTime);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 24, total: 0 });

  const { name: collection, path } = useRouteProps();

  useEffect(() => {
    setHeaderActions([{
      text: '新建',
      execute: () => history.push(`${path}/new`),
      primary: true
    }]);

    setLoading(true);
    getList({ collection, pageSize: pagination.pageSize, pageNum: pagination.current })
      .then(res => {
        setList(res.data.map((item: any) => resolveListItem(item)));
        setPagination({ ...pagination, total: res.extra.total });
      })
      .finally(() => setLoading(false));

    return () => setHeaderActions([]);
  }, [pagination.current, pagination.pageSize, fetchedAt]);

  const paginationProps = {
    ...pagination,
    showTotal: (total: number) => `共 ${total} 条数据`,
    onChange: (page: number, pageSize: number) => setPagination({ ...pagination, pageSize, current: page }),
  };

  const onDelete = (item: Record<string, any>) => deleteOne({ collection, id: item.id }).then(res => {
    if (res.success) {
      message.success('删除成功');
      setFetchedAt(Date.now());
    } else {
      message.error(res.message);
    }
  });

  return (
    <ViewWrapper className={style.QiiList} loading={loading}>
      <CardListViewWidget dataSource={list} pagination={paginationProps} onDelete={onDelete} />
    </ViewWrapper>
  );
}
