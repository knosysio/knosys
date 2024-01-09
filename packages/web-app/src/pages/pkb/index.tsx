import { useLocation, useRouteData, useRouteProps } from 'umi';

export default function PersonalKnowledgeBase() {
  const location = useLocation();
  const route = useRouteData();
  const routeProps = useRouteProps();
  // console.log(routeProps, route, location);

  return <div>{ routeProps.name }</div>;
}
