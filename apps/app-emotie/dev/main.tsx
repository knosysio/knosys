import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import type { WebContext, WebExtension } from '@emotie/extension-sdk/browser';
import { createKnosysWebExtension } from '../src/web-factory';
import DevelopmentHost from './host';
import './style.css';
const root = createRoot(document.getElementById('root')!);
let extension: WebExtension;
const notify = (text: string, kind: 'success' | 'error' = 'success'): void => { window.dispatchEvent(new CustomEvent('knosys-dev:notify', { detail: { text, kind } })); };
const request: typeof fetch = (url, init): Promise<Response> => { const headers = new Headers(init?.headers || (url instanceof Request ? url.headers : undefined)); headers.set('X-Knosys-Dev-Role', sessionStorage.getItem('knosys-dev-role') || 'administrator'); return fetch(url, { ...init, headers }); };
const context: WebContext = { getApps: () => extension?.app ? [extension.app] : [], apiClient: request, notify: (message: string): void => notify(message), navigate: (path: string): void => { window.location.assign(path); } };
function mount(factory: typeof createKnosysWebExtension): void {
  extension?.dispose?.();
  extension = factory(context, { fetch: request, notify });
  root.render(<BrowserRouter><DevelopmentHost extension={extension} /></BrowserRouter>);
}
mount(createKnosysWebExtension);
if (import.meta.hot) {
  import.meta.hot.accept('../src/web-factory', (module): void => { if (module) mount(module.createKnosysWebExtension); });
  import.meta.hot.dispose((): void => { extension.dispose?.(); root.unmount(); });
}
