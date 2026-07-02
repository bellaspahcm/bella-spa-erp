'use client';

import { QueryClient, QueryClientProvider as TanstackQueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

/**
 * React Query Provider
 * 
 * Wraps the application with QueryClientProvider to enable data fetching hooks
 * used by Intelligence Layer dashboards (Forecast, Recommendations, etc.)
 * 
 * @see https://tanstack.com/query/latest/docs/framework/react/quick-start
 */
export function QueryClientProvider({ children }: { children: ReactNode }) {
  // Create QueryClient instance once per component mount
  // Using useState ensures client is stable across re-renders
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: how long data is considered fresh
            staleTime: 5 * 60 * 1000, // 5 minutes
            
            // Cache time: how long inactive data stays in cache
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            
            // Retry failed queries 2 times
            retry: 2,
            
            // Don't refetch on window focus in production (avoids unnecessary API calls)
            refetchOnWindowFocus: process.env.NODE_ENV === 'development',
            
            // Don't refetch on component mount if data is still fresh
            refetchOnMount: false,
            
            // Don't refetch on network reconnect
            refetchOnReconnect: false,
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
          },
        },
      })
  );

  return (
    <TanstackQueryClientProvider client={queryClient}>
      {children}
    </TanstackQueryClientProvider>
  );
}

