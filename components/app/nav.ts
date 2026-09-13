'use client';

import { createContext, useContext } from 'react';
import type { ViewRoute } from '@/lib/types';

export interface NavApi {
  route: ViewRoute;
  navigate: (view: ViewRoute['view'], param?: string) => void;
}

export const NavContext = createContext<NavApi>({
  route: { view: 'home' },
  navigate: () => {},
});

export function useNav() {
  return useContext(NavContext);
}
