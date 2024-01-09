import { AxiosRequestConfig } from 'axios';

import httpClient from "@/shared/utils/http";

function setInterceptorsForHttpClient() {
  httpClient.interceptors.request.use(config => {
    return {
      ...config,
      headers: {
        ...config.headers,
        'X-Knosys-App': (process.env.KNOSYS_APP as any).name,
      },
    } as AxiosRequestConfig;
  });
}

export { setInterceptorsForHttpClient };
