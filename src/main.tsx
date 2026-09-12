import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {initI18n} from '@/lib/i18n';
import '@/styles/global.css';
import {AuthProvider} from '@/lib/auth/AuthContext';
import {ToastProvider} from '@/components/ui/ToastProvider';
import {App} from './App';

/**
 * Query defaults tuned for a marketplace: data is fresh enough to avoid
 * duplicate requests while navigating, but never so stale that a sold or
 * deleted listing lingers.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        const status = (error as {response?: {status?: number}})?.response?.status;
        if (status && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

// Translations are awaited so the first paint is already localized rather
// than flashing raw keys.
void initI18n().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
});
