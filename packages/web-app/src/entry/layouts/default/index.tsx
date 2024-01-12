import { useState } from 'react'
import { useAppData, useRouteProps, history, Outlet } from 'umi';
import { ConfigProvider, Layout, Menu, Breadcrumb, Avatar } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';

import LayoutContext from '@/shared/contexts/layout';

import { resolveMenuItems, resolvePathStuff } from './helper';
import style from './style.scss';

const { Header, Content, Sider } = Layout

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(true);
  const [page, setPage] = useState(null);

  const routeProps = useRouteProps();
  const { clientRoutes } = useAppData();

  const { routes = [] } = clientRoutes[0]
  const { menu: menuKeys, breadcrumb } = resolvePathStuff(routeProps, routes, page);

  const { title } = process.env.KNOSYS_APP as any;

  return (
    <ConfigProvider locale={zhCN}>
      <LayoutContext.Provider value={{ setPage }}>
        <Layout className={style.DefaultLayout}>
          <Sider className={style['DefaultLayout-sidebar']} collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
            <div className={style['DefaultLayout-logo']}>{ collapsed ? title.slice(0, 2) : title }</div>
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
              <Avatar src={require('@/shared/images/avatar.jpg')} size="large" />
            </Header>
            <Content className={style['DefaultLayout-body']}>
              <div className={style['DefaultLayout-content']}>
                <Outlet />
              </div>
            </Content>
          </Layout>
        </Layout>
      </LayoutContext.Provider>
    </ConfigProvider>
  );
}
