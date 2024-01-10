import { Table } from 'antd';

import type { ListViewWidgetProps } from './typing';

function TableViewWidget({ dataSource, pagination }: ListViewWidgetProps) {
  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '简介', dataIndex: 'description', key: 'description' },
  ];

  return (
    <Table
      dataSource={dataSource}
      columns={columns}
      pagination={pagination}
    />
  );
}

export default TableViewWidget;
