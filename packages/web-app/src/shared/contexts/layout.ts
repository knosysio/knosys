import { createContext } from 'react';

const LayoutContext = createContext({
  setPage: (page: any) => {},
});

LayoutContext.displayName = 'LayoutContext';

export default LayoutContext;
