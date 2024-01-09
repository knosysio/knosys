import { capitalize } from '@ntks/toolbox';

function resolveRouteBase(route: any) {
  const resolved: any = { name: route.name, path: `/${route.path}` };

  if (route.meta) {
    resolved.meta = route.meta;
  }

  return resolved;
}

function resolveActionRoutePathPart(action: string) {
  if (action === 'create') {
    return 'new';
  }

  if (action === 'update') {
    return ':id/edit';
  }

  return ':id';
}

function resolveCollectionRoutes(route: any) {
  const baseRoute = resolveRouteBase(route);

  return [
    { ...baseRoute, component: 'pkb' },
    ...['create', 'update', 'read'].map(action => ({
      name: `${baseRoute.name}${capitalize(action)}`,
      path: `${baseRoute.path}/${resolveActionRoutePathPart(action)}`,
      component: 'qii',
      meta: { hide: true, collection: baseRoute.name },
    })),
  ];
}

function resolveRoutes() {
  const generated = require(`${decodeURIComponent(process.env.KNOSYS_APP_PATH!)}/app.json`).routes;

  return generated.map((route: any) => {
    const resolved: any = resolveRouteBase(route);
    const children: any[] = [];

    (route.children || []).forEach((child: any) => {
      children.push(...resolveCollectionRoutes(child));
    });

    if (children.length > 0) {
      children.unshift({ path: route.path, redirect: children[0].path });

      resolved.routes = children;
    }

    return resolved;
  });
}

export default [
  { name: 'root', path: '/', component: 'index' },
  ...resolveRoutes(),
  {
    name: 'settings',
    path: '/settings',
    component: 'settings',
    meta: { text: '设置' },
  },
];
