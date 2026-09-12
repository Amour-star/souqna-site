import {Navigate, useLocation} from 'react-router-dom';
import type {ReactNode} from 'react';
import {useAuth} from '@/lib/auth/AuthContext';
import {LoadingState} from '@/components/ui';

/**
 * Client-side route guard.
 *
 * This is a UX affordance only — every protected action is also authorised
 * server-side by the API, which is the actual security boundary.
 */
export const RequireAuth = ({children}: {children: ReactNode}) => {
  const {isAuthenticated, isLoading} = useAuth();
  const location = useLocation();

  if (isLoading) return <LoadingState />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{from: `${location.pathname}${location.search}`}}
      />
    );
  }

  return <>{children}</>;
};
