import { useState, useEffect } from 'react';
import { useRouteProps, history } from 'umi';
import { Flex, Table, Row, Col, Card, Pagination } from 'antd';

import httpClient from '@/shared/utils/http';

export default function PersonalKnowledgeBase() {
  const [list, setList] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const routeProps = useRouteProps();
  const columns = [{ title: '标题', dataIndex: 'title', key: 'title' }];

  useEffect(() => {
    httpClient.get('/api/qii/query', {
      params: { collection: routeProps.name, pageSize: pagination.pageSize, pageNum: pagination.current },
    }).then(({ data }) => {
      setList(data.list.map((item: any) => ({ id: item.id, key: item.path, title: item.title || item.path, description: item.description })));
      setPagination({ ...pagination, total: data.total });
    });
  }, [pagination.current, pagination.pageSize]);

  const paginationProps = {
    ...pagination,
    showTotal: (total: number) => `共 ${total} 条数据`,
    onChange: (page: number, pageSize: number) => setPagination({ ...pagination, pageSize, current: page }),
  };

  const gotoDetail = (item: any) => history.push(`${routeProps.path}/${item.id}`)

  return (
    <div>
      <Flex align="center" justify="space-between">
        <h3>{routeProps.meta && routeProps.meta.text || routeProps.name}</h3>
        <Pagination {...paginationProps} />
      </Flex>
      <Row gutter={16}>
        {list.map((item: any) => (<Col span={6} key={item.key} style={{paddingTop: '8px', paddingBottom: '8px'}}>
          <Card title={item.title} hoverable onClick={() => gotoDetail(item)}>{item.description || '暂无'}</Card>
        </Col>))}
      </Row>
      {/* <Table
        dataSource={list}
        columns={columns}
        pagination={paginationProps}
      /> */}
    </div>
  );
}
