"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ToastProvider } from "@/components/ui";

/**
 * Server state is TanStack Query's job; UI state is React's; filter state is
 * the URL's. Nothing else is global, and there is no client-side store.
 *
 * The client is created inside state so that a fast refresh (or a second
 * render in strict mode) does not throw away the cache.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            // One retry: enough to ride out a cold start on a free-tier host,
            // not so many that a genuine failure takes ten seconds to surface.
            retry: 1,
          },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
