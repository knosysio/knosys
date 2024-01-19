import { useState, useEffect } from 'react';
import { useRouteProps } from 'umi';
import { Spin, message } from 'antd';

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

export default function QiiList() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [pagination, setPagination] = useState({ current: 1, pageSize: 24, total: 0 });

  const { name: collection } = useRouteProps();

  useEffect(() => {
    setLoading(true);
    getList({ collection, pageSize: pagination.pageSize, pageNum: pagination.current })
      .then(res => {
        setList(res.data.map((item: any) => resolveListItem(item)));
        setPagination({ ...pagination, total: res.extra.total });
      })
      .finally(() => setLoading(false));
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
    <div className={style.QiiList}>
      <Spin size="large" spinning={loading}>
        <CardListViewWidget dataSource={list} pagination={paginationProps} onDelete={onDelete} />
      </Spin>
    </div>
  );
}
