import { AxiosRequestConfig } from 'axios';

import { getCachedAppName } from '@/shared/utils/cache';
import httpClient from "@/shared/utils/http";

function setInterceptorsForHttpClient() {
  httpClient.interceptors.request.use(config => {
    return {
      ...config,
      headers: {
        ...config.headers,
        'X-Knosys-App': getCachedAppName(),
      },
    } as AxiosRequestConfig;
  });

  httpClient.interceptors.response.use(res => res.status === 200 ? { success: true, ...res.data } : { success: false, message: res.data });
}

export { setInterceptorsForHttpClient };
