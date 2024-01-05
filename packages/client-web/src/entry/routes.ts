const { getGlobalConfigDirPath } = require('../../../backend-core/utils');

function resolveRouteBase(route: any) {
  const resolved: any = { name: route.name, path: route.path };

  if (route.meta && route.meta.title) {
    resolved.meta = { text: route.meta.title };
  }

  return resolved;
}

function resolveRoutes() {
  const generated = require(`${getGlobalConfigDirPath()}/apps/${process.env.KNOSYS_APP_NAME}/routes.json`);

  return generated.map((route: any) => {
    const resolved: any = resolveRouteBase(route);
    const children: any[] = (route.children || []).map((child: any) => ({ ...resolveRouteBase(child), component: 'pkb' }));

    if (children.length > 0) {
      children.unshift({ path: route.path, redirect: children[0].path });

      resolved.routes = children;
    }

    return resolved;
  });
}

export default [
  { name: 'root', path: "/", component: "index" },
  ...resolveRoutes(),
  {
    name: 'settings',
    path: '/settings',
    component: 'settings',
    meta: { text: '设置' },
  },
];
