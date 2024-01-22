import { useState } from 'react'
import { useAppData, useRouteProps, history, Outlet } from 'umi';
import { Layout, Menu, Breadcrumb, Avatar } from 'antd';

import LayoutContext from '@/shared/contexts/layout';

import HeaderActionBar from './HeaderActionBar';
import { resolveMenuItems, resolvePathStuff } from './helper';
import style from './style.scss';

const { Header, Content, Sider } = Layout

export default function DefaultLayout({ app }) {
  const [collapsed, setCollapsed] = useState(true);
  const [page, setPage] = useState(null);
  const [headerActions, setHeaderActions] = useState([]);

  const routeProps = useRouteProps();
  const { clientRoutes } = useAppData();

  const { routes = [] } = clientRoutes[0]
  const { menu: menuKeys, breadcrumb } = resolvePathStuff(routeProps, routes, page);

  return (
    <LayoutContext.Provider value={{ setPage, setHeaderActions }}>
      <Layout className={style.DefaultLayout}>
        <Sider className={style['DefaultLayout-sidebar']} collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
          <div className={style['DefaultLayout-logo']}>
            {collapsed ? <Avatar src={require('@/shared/images/avatar.jpg')} size="large" /> : <span className={style['DefaultLayout-logoText']}>{app.title}</span>}
          </div>
          <div className={style['DefaultLayout-navMenu']}>
            <Menu
              theme="dark"
              defaultSelectedKeys={menuKeys}
              defaultOpenKeys={!collapsed && menuKeys.length > 1 ? [menuKeys[0]] : undefined}
              mode="inline"
              items={resolveMenuItems(routes)}
              onSelect={({ key }) => history.push(key)}
            />
          </div>
        </Sider>
        <Layout className={style['DefaultLayout-main']}>
          <Header className={style['DefaultLayout-header']}>
            <Breadcrumb items={breadcrumb} />
            {headerActions.length > 0 ? <HeaderActionBar actions={headerActions} /> : null}
          </Header>
          <Content className={style['DefaultLayout-body']}>
            <div className={style['DefaultLayout-content']}>
              <Outlet />
            </div>
          </Content>
        </Layout>
      </Layout>
    </LayoutContext.Provider>
  );
}
