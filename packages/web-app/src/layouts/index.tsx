import { useState } from 'react'
import { useAppData, history, Link, Outlet } from 'umi';
import { Layout, Menu, theme } from 'antd';

import style from './style.scss'

const { Header, Content, Footer, Sider } = Layout

function resolveMenuItems(routes = []) {
  const items = [];

  routes.forEach(route => {
    if (route.redirect || !route.name || route.meta && route.meta.hide) {
      return;
    }

    const resolved = {
      label: route.path === '/' ? '首页' : (route.meta && route.meta.text || route.name),
      key: route.path,
    };
    const children = resolveMenuItems(route.routes);

    if (children.length > 0) {
      resolved.children = children;
    }

    items.push(resolved);
  })

  return items;
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [menuKeys, setMenuKeys] = useState(['home']);

  const { clientRoutes } = useAppData();
  const { title } = process.env.KNOSYS_APP as any;

  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div className={style['AppLayout-logo']}>{ collapsed ? title.slice(0, 2) : title }</div>
        <Menu
          theme="dark"
          selectedKeys={menuKeys}
          mode="inline"
          items={resolveMenuItems(clientRoutes[0].routes)}
          onClick={({ key }) => {
            setMenuKeys([key]);
            history.push(key);
          }}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: colorBgContainer }}></Header>
        <Content style={{ margin: '24px 16px 0' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          KnoSys ©{new Date().getFullYear()} Created by Ourai L.
        </Footer>
      </Layout>
    </Layout>
  );
}
