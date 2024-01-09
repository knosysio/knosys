import { useState, useEffect } from 'react';
import axios from 'axios'
import { useRouteProps } from 'umi';
import { Table } from 'antd';

export default function PersonalKnowledgeBase() {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  
  const routeProps = useRouteProps();
  const columns = [{ title: '标题', dataIndex: 'title', key: 'title' }];

  useEffect(() => {
    axios.get('/api/query', {
      headers: { 'X-Knosys-App': (process.env.KNOSYS_APP as any).name },
      params: { collection: routeProps.name, pageSize: pagination.pageSize, pageNum: pagination.current },
    }).then(({ data }) => {
      setList(data.list.map((item: any) => ({ key: item.path, title: item.title || item.path })));
      setPagination({ ...pagination, total: data.total });
    });
  }, [pagination.current, pagination.pageSize]);

  return (
    <div>
      <h3>{routeProps.meta && routeProps.meta.text || routeProps.name}</h3>
      <Table
        dataSource={list}
        columns={columns}
        pagination={{
          ...pagination,
          showTotal: (total) => `共 ${total} 条数据`,
          onChange: (page, pageSize) => setPagination({ ...pagination, pageSize, current: page }),
        }}
      />
    </div>
  );
}
