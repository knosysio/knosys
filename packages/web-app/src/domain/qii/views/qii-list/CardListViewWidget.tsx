import { useRouteProps, history } from 'umi';
import { Row, Col, Card, Pagination } from 'antd';

import type { ListViewWidgetProps } from './typing';
import style from './style.scss';

function CardListViewWidget({ dataSource = [], pagination }: ListViewWidgetProps) {
  const routeProps = useRouteProps();
  const gotoDetail = (item: any) => history.push(`${routeProps.path}/${item.id}`);
  const defaultBanner = require('./default-banner.jpg');

  return (
    <div className={style.CardListViewWidget}>
      <Row className={style['CardListViewWidget-list']} gutter={16}>
        {dataSource.map((item: any) => (<Col span={6} key={item.key} style={{paddingTop: '8px', paddingBottom: '8px'}}>
          <Card
            cover={<img src={defaultBanner} />}
            hoverable
            onClick={() => gotoDetail(item)}
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
