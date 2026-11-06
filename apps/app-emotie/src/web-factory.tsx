import { createElement, useEffect, type ReactElement } from 'react';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import type { WebContext, WebExtension } from '@emotie/extension-sdk/browser';
import { KnosysCore, KnosysSidebar } from '@knosys/web-core/browser';
import type { CoreEnvironment } from '@knosys/web-core/contracts';
export interface HostServices { fetch: (url: string, init?: RequestInit) => Promise<Response>; notify: (message: string, kind: 'success' | 'error') => void }
export function createKnosysWebExtension(_context: WebContext, services: HostServices): WebExtension {
  const portal: HTMLElement = document.createElement('div'); portal.dataset.emotieExtension = 'knosys'; document.body.append(portal);
  const environment: CoreEnvironment = { apiBase: '/api/knosys/v1', basePath: '/apps/knosys', fetch: services.fetch, portalContainer: portal, notify: services.notify };
  const View = (): ReactElement => { useEffect((): (() => void) => { document.body.append(portal); return (): void => { portal.remove(); }; }, []); return createElement(KnosysCore, { environment }); };
  return { id: 'knosys', app: { name: '知识库', path: '/apps/knosys', icon: BookOpenIcon, description: 'KnoSys 知识库管理', type: 'builtin', color: 'bg-green-500' }, routes: [{ path: '/apps/knosys/*', element: createElement(View) }], settingsPath: '/apps/knosys/settings', SidebarSlot: ({ onRoutesChange }) => createElement(KnosysSidebar, { environment, onRoutesChange }), dispose: (): void => { portal.remove(); } };
}
