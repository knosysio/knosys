import { Link } from 'umi';
import { HomeOutlined, FileTextOutlined, SettingOutlined, EllipsisOutlined } from '@ant-design/icons'

import { getCachedAppName } from '@/shared/utils/cache';

import type { AppConfig } from '../../../domain/app/typing';

function resolveCurrentApp(apps: AppConfig[]): AppConfig | undefined {
  const cachedApp = getCachedAppName();

  let currentApp;

  if (cachedApp) {
    currentApp = apps.find(({ name }) => name === cachedApp);
  }

  if (!currentApp) {
    currentApp = apps[0];
  }

  return currentApp;
}

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

  const nextLevel = level + 1;
  const dividerItem = { type: 'divider' };

  others.forEach((route: any) => {
    if (route.redirect || !route.name || route.meta && route.meta.hide) {
      return;
    }

    if (route.name === 'settings') {
      items.push(dividerItem);
    }

    items.push(resolveMenuItem(route, resolveMenuItems(route.routes, nextLevel)));

    if (isHomePage(route.path)) {
      items.push(dividerItem);
    }
  })

  if (moreRoute) {
    items.push(resolveMenuItem(moreRoute, resolveMenuItems(childrenOfMore, nextLevel)));
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

function resolveBreadcrumbItems(breadcrumb: any[], routePath: any[], collection?: string, page?: any): any[] {
  if (!collection || !page) {
    return breadcrumb;
  }

  const collectionInfo = routePath[0].children.find((item: any) => item.name === collection);

  return [breadcrumb[0], { title: <Link to={collectionInfo.path}>{collectionInfo.meta && collectionInfo.meta.text}</Link> }, { title: page.title }];
}

function resolvePathStuff(routeProps: any, routes: any[], page: any): { menu: string[]; breadcrumb: any[] } {
  const paths = resolveCurrentPaths(routeProps, routes);

  const menu: string[] = [];
  const breadcrumb: any[] = [];

  paths.forEach(route => {
    menu.push(route.path);
    breadcrumb.push({ title: route.meta && route.meta.text });
  });

  return { menu, breadcrumb: resolveBreadcrumbItems(breadcrumb, paths, routeProps.meta && routeProps.meta.collection, page) };
}

export { resolveCurrentApp, resolveMenuItems, resolvePathStuff };
