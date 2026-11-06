import { authenticatedFetch } from '@emotie/ui/auth/session';
import { toast } from '@emotie/ui/toast';
import type { WebContext, WebExtension } from '@emotie/extension-sdk/browser';
import { createKnosysWebExtension } from './web-factory';
export function createWebExtension(context: WebContext): WebExtension {
  return createKnosysWebExtension(context, { fetch: authenticatedFetch, notify: (message, kind): void => { toast[kind](message); } });
}
