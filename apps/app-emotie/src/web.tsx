import { createElement, useEffect, type ReactElement } from 'react';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { authenticatedFetch } from '@emotie/ui/auth/session';
import { toast } from '@emotie/ui/toast';
import type { WebContext, WebExtension } from '@emotie/extension-sdk/browser';
import { KnosysCore, KnosysSidebar } from '@knosys/web-core/browser';
import type { CoreEnvironment } from '@knosys/web-core/contracts';
export function createWebExtension(_context: WebContext): WebExtension {
  const portal: HTMLElement = document.createElement('div'); portal.dataset.emotieExtension = 'knosys'; document.body.append(portal);
  const environment: CoreEnvironment = { apiBase: '/api/knosys/v1', basePath: '/apps/knosys', fetch: authenticatedFetch, portalContainer: portal, notify: (message: string, kind: 'success' | 'error'): void => { toast[kind](message); } };
  const View = (): ReactElement => { useEffect((): (() => void) => { document.body.append(portal); return (): void => { portal.remove(); }; }, []); return createElement(KnosysCore, { environment }); };
  return { id: 'knosys', app: { name: '知识库', path: '/apps/knosys', icon: BookOpenIcon, description: 'KnoSys 知识库管理', type: 'builtin', color: 'bg-green-500' }, routes: [{ path: '/apps/knosys/*', element: createElement(View) }], settingsPath: '/apps/knosys/settings', SidebarSlot: ({ onRoutesChange }) => createElement(KnosysSidebar, { environment, onRoutesChange }), dispose: (): void => { portal.remove(); } };
}
