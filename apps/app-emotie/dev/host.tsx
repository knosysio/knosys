import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Button } from '@heroui/react';
import { Bars3Icon, HomeIcon } from '@heroicons/react/24/outline';
import type { WebExtension } from '@emotie/extension-sdk/browser';
import type { MenuItem } from '@knosys/web-core/contracts';
export default function DevelopmentHost({ extension }: { extension: WebExtension }): ReactElement {
  const [navigation, setNavigation] = useState<MenuItem[]>([]);
  const [sidebar, setSidebar] = useState(true);
  const [role, setRole] = useState(sessionStorage.getItem('knosys-dev-role') || 'administrator');
  const [message, setMessage] = useState<{ text: string; kind: string } | null>(null);
  const location = useLocation();
  const updateNavigation = useCallback((items: MenuItem[]): void => setNavigation(items), []);
  useEffect((): (() => void) => {
    let timer: ReturnType<typeof setTimeout>;
    const receive = (event: Event): void => { setMessage((event as CustomEvent<{ text: string; kind: string }>).detail); clearTimeout(timer); timer = setTimeout((): void => setMessage(null), 6000); };
    window.addEventListener('knosys-dev:notify', receive);
    return (): void => { clearTimeout(timer); window.removeEventListener('knosys-dev:notify', receive); };
  }, []);
  const Sidebar = extension.SidebarSlot;
  return <div className="development-shell" data-sidebar-open={sidebar}>
    <header className="development-header"><div className="flex min-w-0 items-center gap-2"><Button isIconOnly variant="secondary" aria-label={sidebar ? '隐藏侧边栏' : '显示侧边栏'} onPress={(): void => setSidebar(!sidebar)}><Bars3Icon className="size-5" /></Button><Link className="development-home" to="/apps/knosys" aria-label="知识库首页"><HomeIcon className="size-5" /><span>{extension.app?.name || '知识库'}</span></Link></div><div className="flex items-center gap-2"><span className="development-badge">本地开发</span><select aria-label="开发身份" value={role} onChange={(event): void => { const value: string = event.target.value; sessionStorage.setItem('knosys-dev-role', value); setRole(value); window.location.reload(); }}><option value="administrator">管理员</option><option value="reader">普通用户</option><option value="anonymous">未登录</option></select></div></header>
    <aside className="development-sidebar" ref={(node): void => { if (node) node.inert = !sidebar; }} aria-hidden={!sidebar} aria-label="扩展导航">{Sidebar && <Sidebar onRoutesChange={updateNavigation} />}<nav>{navigation.map((item): ReactElement => <Link key={item.id} to={item.path || '/apps/knosys'} aria-current={location.pathname + location.search === item.path ? 'page' : undefined}><item.icon className="size-5 shrink-0" />{item.name}</Link>)}</nav>{extension.settingsPath && <Link className="development-settings" to={extension.settingsPath}>设置</Link>}</aside>
    <main className="development-main"><Routes>{extension.routes.map((route, index): ReactElement => <Route key={index} path={route.path} element={route.element} />)}<Route path="/" element={<Navigate to="/apps/knosys" replace />} /><Route path="*" element={<p role="alert">页面不存在</p>} /></Routes></main>
    {message && <div className={'development-toast ' + message.kind} role={message.kind === 'error' ? 'alert' : 'status'}><span>{message.text}</span><button aria-label="关闭提示" onClick={(): void => setMessage(null)}>×</button></div>}
  </div>;
}
