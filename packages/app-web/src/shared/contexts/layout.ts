import { createContext } from 'react';

const LayoutContext = createContext({
  setPage: (page: any) => {},
  setHeaderActions: (actions: any) => {},
});

LayoutContext.displayName = 'LayoutContext';

export default LayoutContext;
