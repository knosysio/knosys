/**
 * Resolve permalink from schema and params
 */
export function resolvePermalink(schema: string, params: any): string {
  const segs = schema.split('/').map(seg => {
    if (seg === '' || !/^\:[0-9a-z-_]+$/i.test(seg)) {
      return seg;
    }

    const param = seg.slice(1);

    return params[param === 'path' ? 'slug' : param];
  }).filter(seg => !!seg);

  return segs.length > 0 ? `/${segs.join('/')}/` : '/';
}
