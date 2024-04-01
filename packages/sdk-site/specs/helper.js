function resolvePermalink(schema, params) {
  const segs = schema.split('/').map(seg => {
    if (seg === '' || !/^\:[0-9a-z-_]+$/i.test(seg)) {
      return seg;
    }

    const param = seg.slice(1);

    return params[param === 'path' ? 'slug' : param];
  }).filter(seg => !!seg);

  return segs.length > 0 ? `/${segs.join('/')}/` : '/';
}

module.exports = { resolvePermalink };
