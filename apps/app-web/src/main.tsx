import { useState, useEffect, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { KnosysCore, KnosysSidebar } from '@knosys/web-core/browser';
import type { CoreEnvironment } from '@knosys/web-core/contracts';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import './style.css';
const portal: HTMLElement = document.createElement('div'); portal.dataset.emotieExtension = 'knosys'; document.body.append(portal);
const environment: CoreEnvironment = { apiBase: '/api/knosys/v1', basePath: '/', fetch: window.fetch.bind(window), portalContainer: portal, notify: (message: string, kind: 'success' | 'error'): void => { window.dispatchEvent(new CustomEvent('knosys:toast', { detail: { message, kind } })); } };
function App(): ReactElement {
  const [toast, setToast] = useState<{ message: string; kind: string } | null>(null);
  useEffect((): (() => void) => { let timer: ReturnType<typeof setTimeout>; const receive = (event: Event): void => { setToast((event as CustomEvent<{ message: string; kind: string }>).detail); clearTimeout(timer); timer = setTimeout((): void => setToast(null), 6000); }; window.addEventListener('knosys:toast', receive); return (): void => { clearTimeout(timer); window.removeEventListener('knosys:toast', receive); }; }, []);
  return <BrowserRouter><div className="knosys-shell"><aside className="knosys-shell-sidebar"><a className="knosys-brand" href="/"><BookOpenIcon className="size-6" /><span>KnoSys</span></a><KnosysSidebar environment={environment} /></aside><main><KnosysCore environment={environment} /></main></div>{toast && <div role={toast.kind === 'error' ? 'alert' : 'status'} className={'knosys-toast ' + toast.kind}><span>{toast.message}</span><button type="button" aria-label="关闭提示" onClick={(): void => setToast(null)}>×</button></div>}</BrowserRouter>;
}
createRoot(document.getElementById('root')!).render(<App />);
