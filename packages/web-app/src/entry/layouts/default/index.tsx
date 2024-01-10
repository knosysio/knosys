import { useState } from 'react'
import { useAppData, history, Outlet } from 'umi';
import { ConfigProvider, Layout, Menu } from 'antd';
import zhCN from 'antd/es/locale/zh_CN';
import { HomeOutlined, FileTextOutlined, SettingOutlined } from '@ant-design/icons'

import style from './style.scss';

const { Header, Content, Footer, Sider } = Layout

const routeIconMap: Record<string, any> = {
  home: HomeOutlined,
  settings: SettingOutlined,
};

function resolveMenuItems(routes = []) {
  const items = [];

  routes.forEach(route => {
    if (route.redirect || !route.name || route.meta && route.meta.hide) {
      return;
    }

    const resolved = {
      label: route.meta && route.meta.text || route.name,
      key: ['/', ''].includes(route.path) ? '/' : route.path,
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

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(true);
  const [menuKeys, setMenuKeys] = useState(['home']);

  const { clientRoutes } = useAppData();
  const { title } = process.env.KNOSYS_APP as any;

  return (
    <ConfigProvider locale={zhCN}>
      <Layout className={style.DefaultLayout}>
        <Sider className={style['DefaultLayout-sidebar']} collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
          <div className={style['DefaultLayout-logo']}>{ collapsed ? title.slice(0, 2) : title }</div>
          <div className={style['DefaultLayout-navMenu']}>
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
