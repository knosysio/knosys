const APP_CACHE_KEY = '__knosys_app__';

function cacheAppName(appName: string) {
  localStorage.setItem(APP_CACHE_KEY, appName);
}

function getCachedAppName(): string | null | undefined {
  return localStorage.getItem(APP_CACHE_KEY);
}

export { cacheAppName, getCachedAppName };
