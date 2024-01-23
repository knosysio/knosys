import { history } from 'umi';
import { Switch, Button, Table } from 'antd';

const columns = [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    width: 180,
    render: (text: string)=> <code>{text}</code>,
  },
  {
    title: '标题',
    dataIndex: 'title',
    key: 'title',
    width: 150,
  },
  {
    title: '记录路径',
    dataIndex: 'path',
    key: 'path',
    render: (text?: string)=> text ? <code>{text}</code> : '-',
  },
  {
    title: '启用',
    dataIndex: 'app',
    key: 'app',
    width: 100,
    render: (value?: boolean)=> <Switch checked={value !== false} />,
  },
  {
    title: '操作',
    key: 'operation',
    render: (_, { name })=> (
      <>
        <a href="javascript:void(0);" onClick={() => history.push(`/settings/collections/${name}/design`)}>模型设计</a>
      </>
    ),
  },
];

const dataSource: Record<string, any>[] = [
  { name: 'posts', title: '文章', path: ':year/:month/:slug' },
  { name: 'murmurs', title: '想法', path: ':year/:month/:date/:time' },
  { name: 'media', title: '媒体', app: false },
];

function CollectionListViewWidget() {
  return (
    <Table
      columns={columns}
      dataSource={dataSource}
      rowKey="name"
      pagination={false}
    />
  );
}

export default CollectionListViewWidget;
