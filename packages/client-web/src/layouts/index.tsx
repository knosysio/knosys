import { useState } from 'react'
import { Link, Outlet } from 'umi';
import { Layout, theme } from 'antd';

const { Header, Content, Footer, Sider } = Layout

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}></Sider>
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
