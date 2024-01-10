import { useState } from 'react'
import { useAppData, useRouteProps, history, Outlet } from 'umi';
import { HomeOutlined, FileTextOutlined, SettingOutlined, EllipsisOutlined } from '@ant-design/icons'
import { ConfigProvider, Layout, Menu, Breadcrumb, Avatar } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';

import style from './style.scss';

const { Header, Content, Sider } = Layout

const routeIconMap: Record<string, any> = {
  home: HomeOutlined,
  settings: SettingOutlined,
  more: EllipsisOutlined,
};

const HOME_PATH = '/';

function isHomePage(routePath: string): boolean {
  return [HOME_PATH, ''].includes(routePath)
}

function resolveMenuItem(route: any, children: any[] = []) {
  const resolved: any = {
    label: route.meta && route.meta.text || route.name,
    key: isHomePage(route.path) ? HOME_PATH : route.path,
  };

  if (children.length > 0) {
    resolved.children = children;
    resolved.icon = <FileTextOutlined />
  }

  const RouteIcon = routeIconMap[route.name];

  if (RouteIcon) {
    resolved.icon = <RouteIcon />;
  }

  return resolved;
}

function resolveMenuItems(routes: any[] = [], level: number = 1) {
  const items: any[] = [];
  const others: any[] = level === 1 ? [] : routes;

  let moreRoute: any;

  const childrenOfMore: any[] = [];

  if (level === 1) {
    routes.forEach(route => {
      if (route.name === 'more') {
        moreRoute = route;
      } else if (['about'].includes(route.name)) {
        childrenOfMore.push(route);
      } else {
        others.push(route);
      }
    });
  }

  others.forEach((route: any) => {
    if (route.redirect || !route.name || route.meta && route.meta.hide) {
      return;
    }

    items.push(resolveMenuItem(route, resolveMenuItems(route.routes, level + 1)));
  })

  if (moreRoute) {
    items.push(resolveMenuItem(moreRoute, resolveMenuItems(childrenOfMore, level + 1)));
  }

  return items;
}

function resolveCurrentPaths({ id, path, parentId }: any, routes: any[]): any[] {
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
    return [{ ...currentRoute, path: isHomePage(path) ? HOME_PATH : path }];
  }

  currentRoute = parentRoute.routes.find((route: any) => route.id === id);

  return currentRoute ? [parentRoute, currentRoute] : [];
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(true);

  const routeProps = useRouteProps();
  const { clientRoutes } = useAppData();

  const { routes = [] } = clientRoutes[0]
  const paths = resolveCurrentPaths(routeProps, routes);

  const menuKeys: string[] = [];
  const breadcrumbItems: any[] = [];

  paths.forEach(route => {
    menuKeys.push(route.path);
    breadcrumbItems.push({ title: route.meta && route.meta.text });
  });

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
          <Header className={style['DefaultLayout-header']}>
            <Breadcrumb items={breadcrumbItems} />
            <Avatar src={require('@/shared/images/avatar.jpg')} size="large" />
          </Header>
          <Content className={style['DefaultLayout-body']}>
            <div className={style['DefaultLayout-content']}>
              <Outlet />
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
