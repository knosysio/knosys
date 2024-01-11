import { useState, useEffect } from 'react';
import { useRouteProps } from 'umi';
import { message } from 'antd';

import { getList, deleteOne } from '../../repository';

import CardListViewWidget from './CardListViewWidget';
import style from './style.scss';

export default function QiiList() {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const { name: collection } = useRouteProps();

  useEffect(() => {
    getList({ collection, pageSize: pagination.pageSize, pageNum: pagination.current })
      .then(({ data, extra }) => {
        setList(data.map((item: any) => ({ id: item.id, key: item.path, title: item.title || item.path, description: item.description })));
        setPagination({ ...pagination, total: extra.total });
      });
  }, [pagination.current, pagination.pageSize]);

  const paginationProps = {
    ...pagination,
    showTotal: (total: number) => `共 ${total} 条数据`,
    onChange: (page: number, pageSize: number) => setPagination({ ...pagination, pageSize, current: page }),
  };

  const onDelete = (item: Record<string, any>) => deleteOne({ collection, id: item.id }).then(res => res.success ? message.success('删除成功') : message.error(res.message))

  return (
    <div className={style.QiiList}>
      <CardListViewWidget dataSource={list} pagination={paginationProps} onDelete={onDelete} />
    </div>
  );
}
