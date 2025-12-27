import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { SupabaseProvider, AuthProvider } from '@mobileworship/shared';
import { GluestackProvider } from '@mobileworship/ui';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { SongsPage } from './pages/SongsPage';
import { SongDetailPage } from './pages/SongDetailPage';
import { EventsPage } from './pages/EventsPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { DisplaysPage } from './pages/DisplaysPage';
import { DisplayDetailPage } from './pages/DisplayDetailPage';
import { MediaPage } from './pages/MediaPage';
import { SettingsPage } from './pages/SettingsPage';
import { ControlPage } from './pages/ControlPage';
import { PresentationPage } from './pages/PresentationPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AcceptInvitePage } from './pages/AcceptInvitePage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WebDrawerLayout } from './components/WebDrawerLayout';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function DashboardRoutes() {
  return (
    <WebDrawerLayout>
      <Routes>
        <Route index element={<Navigate to="songs" replace />} />
        <Route path="songs" element={<SongsPage />} />
        <Route path="songs/:id" element={<SongDetailPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="displays" element={<DisplaysPage />} />
        <Route path="displays/:id" element={<DisplayDetailPage />} />
        <Route path="media" element={<MediaPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Routes>
    </WebDrawerLayout>
  );
}

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  return (
    <GluestackProvider>
      <QueryClientProvider client={queryClient}>
        <SupabaseProvider supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey}>
          <AuthProvider>
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                  <Route path="/accept-invite" element={<AcceptInvitePage />} />
                  <Route path="/dashboard/*" element={<DashboardRoutes />} />
                  <Route path="/control/:eventId" element={<ControlPage />} />
                  <Route path="/present/:eventId" element={<PresentationPage />} />
                </Routes>
              </ErrorBoundary>
            </BrowserRouter>
          </AuthProvider>
        </SupabaseProvider>
      </QueryClientProvider>
    </GluestackProvider>
  );
}
