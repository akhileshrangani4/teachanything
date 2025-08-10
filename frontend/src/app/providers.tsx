'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'react-hot-toast';
import { Session } from 'next-auth';
import { PropsWithChildren } from 'react';

const queryClient = new QueryClient();

export function Providers({ 
  children, 
  session 
}: PropsWithChildren<{ session: Session | null }>) {
  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="top-right" />
      </QueryClientProvider>
    </SessionProvider>
  );
}


