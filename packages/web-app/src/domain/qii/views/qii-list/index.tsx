import { useState, useEffect } from 'react';
import { useRouteProps } from 'umi';

import { getList } from '../../repository';

import CardListViewWidget from './CardListViewWidget';
import style from './style.scss';

export default function QiiList() {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const routeProps = useRouteProps();

  useEffect(() => {
    getList({ collection: routeProps.name, pageSize: pagination.pageSize, pageNum: pagination.current })
      .then(({ data }) => {
        setList(data.list.map((item: any) => ({ id: item.id, key: item.path, title: item.title || item.path, description: item.description })));
        setPagination({ ...pagination, total: data.total });
      });
  }, [pagination.current, pagination.pageSize]);

  const paginationProps = {
    ...pagination,
    showTotal: (total: number) => `共 ${total} 条数据`,
    onChange: (page: number, pageSize: number) => setPagination({ ...pagination, pageSize, current: page }),
  };

  return (
    <div className={style.QiiList}>
      <CardListViewWidget dataSource={list} pagination={paginationProps} />
    </div>
  );
}
