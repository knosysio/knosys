import { createContext, useContext } from 'react';
import type { CoreEnvironment } from '../contracts/index';
export const Environment = createContext<CoreEnvironment | null>(null);
export function useEnvironment(): CoreEnvironment {
  const value: CoreEnvironment | null = useContext(Environment);
  if (!value) throw new Error('KnoSys environment missing');
  return value;
}
