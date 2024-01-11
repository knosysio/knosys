import { useRouteProps, history } from 'umi';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { Row, Col, Card, Pagination, Modal } from 'antd';

import type { ListViewWidgetProps } from './typing';
import style from './style.scss';

function createActionHandler<R = Record<string, any>>(record: R, callback: (record: R) => void) {
  return (evt: any) => {
    evt.preventDefault();
    evt.stopPropagation();
    callback && callback(record);
  };
}

function CardListViewWidget({ dataSource = [], pagination, onDelete }: ListViewWidgetProps) {
  const routeProps = useRouteProps();
  const defaultBanner = require('./default-banner.jpg');

  const gotoDetail = (item: any) => history.push(`${routeProps.path}/${item.id}`);
  const gotoEdit = (item: any) => history.push(`${routeProps.path}/${item.id}/edit`);
  const removeEntity = (item: any) => Modal.confirm({
    title: `确定要删除${routeProps.meta && routeProps.meta.text || ''}《${item.title || item.key}》？`,
    onOk: () => {
      onDelete && onDelete(item);
    }
  });

  return (
    <div className={style.CardListViewWidget}>
      <Row className={style['CardListViewWidget-list']} gutter={16}>
        {dataSource.map((item: any) => (<Col span={6} key={item.key} style={{paddingTop: '8px', paddingBottom: '8px'}}>
          <Card
            cover={<img src={defaultBanner} />}
            hoverable
            actions={[
              <EditOutlined key="edit" onClick={createActionHandler(item, gotoEdit)} />,
              <DeleteOutlined key="delete" onClick={createActionHandler(item, removeEntity)} />
            ]}
            onClick={createActionHandler(item, gotoDetail)}
          >
            <Card.Meta title={item.title} description={item.description || '暂无'} />
          </Card>
        </Col>))}
      </Row>
      {pagination && pagination.total && pagination.total > pagination.pageSize! ? (
        <div className={style['CardListViewWidget-pagination']}><Pagination {...pagination} /></div>
      ) : null}
    </div>
  );
}

export default CardListViewWidget;
