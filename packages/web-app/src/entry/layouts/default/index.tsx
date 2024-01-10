import { useState } from 'react'
import { useAppData, useRouteProps, history, Outlet } from 'umi';
import { ConfigProvider, Layout, Menu } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';
import { HomeOutlined, FileTextOutlined, SettingOutlined } from '@ant-design/icons'

import style from './style.scss';

const { Header, Content, Footer, Sider } = Layout

const routeIconMap: Record<string, any> = {
  home: HomeOutlined,
  settings: SettingOutlined,
};

const HOME_PATH = '/';

function isHomePage(routePath: string): boolean {
  return [HOME_PATH, ''].includes(routePath)
}

function resolveMenuItems(routes: any[] = []) {
  const items: any[] = [];

  routes.forEach((route: any) => {
    if (route.redirect || !route.name || route.meta && route.meta.hide) {
      return;
    }

    const resolved: any = {
      label: route.meta && route.meta.text || route.name,
      key: isHomePage(route.path) ? HOME_PATH : route.path,
    };
    const children = resolveMenuItems(route.routes);

    if (children.length > 0) {
      resolved.children = children;
      resolved.icon = <FileTextOutlined />
    }

    const RouteIcon = routeIconMap[route.name];

    if (RouteIcon) {
      resolved.icon = <RouteIcon />;
    }

    items.push(resolved);
  })

  return items;
}

function resolveCurrentPaths({ id, path, parentId }: any, routes: any[]): string[] {
  if (isHomePage(path)) {
    return [HOME_PATH];
  }

  let currentRoute: any;
  let parentRoute: any;

  routes.forEach(route => {
    if (route.id === id) {
      currentRoute = route;
    } else if (route.id === parentId) {
      parentRoute = route;
    }
  });

  if (!parentRoute) {
    return [path];
  }

  currentRoute = parentRoute.routes.find((route: any) => route.id === id);

  return currentRoute ? [parentRoute.path, currentRoute.path] : [];
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(true);

  const routeProps = useRouteProps();
  const { clientRoutes } = useAppData();

  const { routes = [] } = clientRoutes[0]
  const menuKeys = resolveCurrentPaths(routeProps, routes);

  const { title } = process.env.KNOSYS_APP as any;

  return (
    <ConfigProvider locale={zhCN}>
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
          <Header className={style['DefaultLayout-header']}></Header>
          <Content className={style['DefaultLayout-body']}>
            <div className={style['DefaultLayout-content']}>
              <Outlet />
            </div>
          </Content>
          <Footer className={style['DefaultLayout-footer']}>
            KnoSys ©{new Date().getFullYear()} Created by Ourai L.
          </Footer>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
