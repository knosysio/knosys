function resolveRouteBase(route: any) {
  const resolved: any = { name: route.name, path: `/${route.path}` };

  if (route.meta) {
    resolved.meta = route.meta;
  }

  return resolved;
}

function resolveRoutes() {
  const generated = require(`${decodeURIComponent(process.env.KNOSYS_APP_PATH!)}/app.json`).routes;

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
