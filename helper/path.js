function resolvePathFromParams(paramPath, params) {
  return paramPath.split('/').map(part => params[part]).join('/');
}

module.exports = { resolvePathFromParams };
