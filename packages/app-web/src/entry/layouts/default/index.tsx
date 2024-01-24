import { useState, useEffect } from 'react';
import { useAppData, useRouteProps, history, Outlet } from 'umi';
import { ConfigProvider, Spin, Layout, Menu, Breadcrumb, Avatar, message } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';

import { cacheAppName } from '@/shared/utils/cache';
import LayoutContext from '@/shared/contexts/layout';

import type { AppConfig } from '../../../domain/app/typing';
import { getList as getAppList } from '../../../domain/app/repository';
import AppInitializerViewWidget from '../../../domain/app/views/app-initializer';

import HeaderActionBar from './HeaderActionBar';
import { resolveCurrentApp, resolveMenuItems, resolvePathStuff } from './helper';
import style from './style.scss';

const { Header, Content, Sider } = Layout

export default function DefaultLayout() {
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [app, setApp] = useState<AppConfig | undefined | null>(null);

  const [collapsed, setCollapsed] = useState(true);
  const [page, setPage] = useState(null);
  const [headerActions, setHeaderActions] = useState([]);

  const routeProps = useRouteProps();
  const { clientRoutes } = useAppData();

  const { routes = [] } = clientRoutes[0]
  const { menu: menuKeys, breadcrumb } = resolvePathStuff(routeProps, routes, page);

  useEffect(() => {
    if (!app && !loading) {
      setLoading(true);
      getAppList()
        .then(res => {
          if (res.success) {
            const currentApp = resolveCurrentApp(res.data);

            if (currentApp) {
              cacheAppName(currentApp.name);
              setApp(currentApp);
              setFetched(true);
            } else {
              message.warning('没有已初始化的应用').then(() => setFetched(true));
            }
          } else {
            message.error(res.message);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [app]);

  return (
    <ConfigProvider locale={zhCN} autoInsertSpaceInButton={false}>
      <Spin size="large" spinning={loading}>
        {fetched ? (
          <LayoutContext.Provider value={{ setPage, setHeaderActions }}>
            <Layout className={style.DefaultLayout}>
              { app ? (
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
              ) : null }
              <Layout className={style['DefaultLayout-main']}>
                <Header className={style['DefaultLayout-header']}>
                  <Breadcrumb items={app ? breadcrumb : [{ title: '初始化' }]} />
                  {headerActions.length > 0 ? <HeaderActionBar actions={headerActions} /> : null}
                </Header>
                <Content className={style['DefaultLayout-body']}>
                  <div className={style['DefaultLayout-content']}>
                    {app ? <Outlet /> : <AppInitializerViewWidget />}
                  </div>
                </Content>
              </Layout>
            </Layout>
          </LayoutContext.Provider>
        ) : null}
      </Spin>
    </ConfigProvider>
  );
}
