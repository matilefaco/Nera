import React from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate,
  useLocation
} from 'react-router-dom';
import { Toaster } from 'sonner';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider, useAuth } from './AuthContext';
import { PendingAppointmentsProvider } from './contexts/PendingAppointmentsContext';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import AppLoadingScreen from './components/AppLoadingScreen';
import { runtimeLogger } from './lib/runtimeDiagnostics';

// Pages (Lazy Loaded for performance)
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const TermsPage = React.lazy(() => import('./pages/TermsPage'));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const ChangePasswordPage = React.lazy(() => import('./pages/ChangePasswordPage'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ServicesPage = React.lazy(() => import('./pages/ServicesPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const ClientsPage = React.lazy(() => import('./pages/ClientsPage'));
const PlansPage = React.lazy(() => import('./pages/PlansPage'));
const AgendaPage = React.lazy(() => import('./pages/AgendaPage'));
const PublicProfile = React.lazy(() => import('./pages/PublicProfile'));
const OnboardingPage = React.lazy(() => import('./pages/OnboardingPage'));
const ReviewPage = React.lazy(() => import('./pages/ReviewPage'));
const BookingResponsePage = React.lazy(() => import('./pages/BookingResponsePage'));
const VerifyEmailPage = React.lazy(() => import('./pages/VerifyEmailPage'));
const AuthActionPage = React.lazy(() => import('./pages/AuthActionPage'));
const PendingRequestsPage = React.lazy(() => import('./pages/PendingRequestsPage'));
const ManageBookingPage = React.lazy(() => import('./pages/ManageBookingPage'));
const CouponsPage = React.lazy(() => import('./pages/CouponsPage'));
const WhatsAppSimulator = React.lazy(() => import('./pages/WhatsAppSimulator'));
const DirectoryPage = React.lazy(() => import('./pages/DirectoryPage'));
const CheckoutSuccessPage = React.lazy(() => import('./pages/CheckoutSuccessPage'));
const CheckoutCanceledPage = React.lazy(() => import('./pages/CheckoutCanceledPage'));
const ReferralsPage = React.lazy(() => import('./pages/ReferralsPage'));
const WhatsAppHistoryPage = React.lazy(() => import('./pages/WhatsAppHistoryPage'));
const FinancialPage = React.lazy(() => import('./pages/FinancialPage'));

// Special handling for named export
const ReviewsModerationPage = React.lazy(() => 
  import('./pages/ReviewsModerationPage').then(m => ({ default: m.ReviewsModerationPage }))
);

function RouteLogger() {
  const location = useLocation();
  const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname.includes('ais-'));

  React.useEffect(() => {
    if (isDev) {
      runtimeLogger.log('route_change', { path: location.pathname });
    }
  }, [location.pathname, isDev]);
  return null;
}

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AppLoadingScreen />;
  
  if (!user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
  }

  // Verification Check
  const isPasswordProvider = user.providerData.some(p => p.providerId === 'password');
  if (isPasswordProvider && !user.emailVerified && location.pathname !== '/verificar-email') {
    return <Navigate to="/verificar-email" />;
  }

  // CRITICAL: Single Source of Truth for Onboarding
  const isCompleted = profile?.onboardingCompleted === true;
  
  // If user is logged in but hasn't finished onboarding, redirect to onboarding
  if (profile && !isCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" />;
  }

  // If user HAS finished onboarding and tries to go back to onboarding, send to dashboard
  if (isCompleted && location.pathname === '/onboarding') {
    return <Navigate to="/dashboard?tab=hoje" />;
  }

  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();

  if (loading) return <AppLoadingScreen />;
  
  if (!user) {
    return <Navigate to="/login" />;
  }

  if (profile?.role !== 'admin') {
    return <Navigate to="/dashboard?tab=hoje" />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    // @ts-ignore
    <HelmetProvider>
      <AuthProvider>
        <PendingAppointmentsProvider>
          <Router>
            <RouteLogger />
            <div className="min-h-screen font-sans selection:bg-brand-rose/20 selection:text-brand-rose">
              <AppErrorBoundary>
                <React.Suspense fallback={<AppLoadingScreen />}>
                  <Routes>
                  {/* ... routes ... */}
                  <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/privacidade" element={<PrivacyPage />} />
              <Route path="/termos" element={<TermsPage />} />
              <Route path="/p/:slug" element={<PublicProfile />} />
              <Route path="/verificar-email" element={<VerifyEmailPage />} />
              <Route path="/auth/action" element={<AuthActionPage />} />
              <Route path="/reserva/:id/gerenciar" element={<ManageBookingPage />} />
              <Route path="/r/:token" element={<ManageBookingPage />} />
              <Route path="/profissionais" element={<DirectoryPage />} />
              <Route path="/review/:token" element={<ReviewPage />} />
              <Route path="/booking-request/:appointmentId/respond" element={<BookingResponsePage />} />
              <Route path="/onboarding" element={
                <PrivateRoute>
                  <OnboardingPage />
                </PrivateRoute>
              } />
              
              <Route path="/dashboard" element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } />
              <Route path="/agenda" element={
                <PrivateRoute>
                  <AgendaPage />
                </PrivateRoute>
              } />
              <Route path="/planos" element={
                <PrivateRoute>
                  <PlansPage />
                </PrivateRoute>
              } />
              <Route path="/pedidos" element={
                <PrivateRoute>
                  <PendingRequestsPage />
                </PrivateRoute>
              } />
              <Route path="/clients" element={
                <PrivateRoute>
                  <ClientsPage />
                </PrivateRoute>
              } />
              <Route path="/financeiro" element={
                <PrivateRoute>
                  <FinancialPage />
                </PrivateRoute>
              } />
              <Route path="/services" element={
                <PrivateRoute>
                  <ServicesPage />
                </PrivateRoute>
              } />
              <Route path="/cupons" element={
                <PrivateRoute>
                  <CouponsPage />
                </PrivateRoute>
              } />
              <Route path="/avaliacoes" element={
                <PrivateRoute>
                  <ReviewsModerationPage />
                </PrivateRoute>
              } />
              <Route path="/profile" element={
                <PrivateRoute>
                  <ProfilePage />
                </PrivateRoute>
              } />
              <Route path="/configuracoes" element={
                <PrivateRoute>
                  <SettingsPage />
                </PrivateRoute>
              } />
              <Route path="/trocar-senha" element={
                <PrivateRoute>
                  <ChangePasswordPage />
                </PrivateRoute>
              } />
              <Route path="/admin/whatsapp-test" element={
                <AdminRoute>
                  <WhatsAppSimulator />
                </AdminRoute>
              } />
              <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
              <Route path="/checkout/canceled" element={<CheckoutCanceledPage />} />
              <Route path="/indicacoes" element={
                <PrivateRoute>
                  <ReferralsPage />
                </PrivateRoute>
              } />
              <Route path="/whatsapp-history" element={
                <PrivateRoute>
                  <WhatsAppHistoryPage />
                </PrivateRoute>
              } />
              <Route path="/plans" element={<Navigate to="/planos" replace />} />
              
              {/* Fallback for unmatched routes */}
              <Route path="*" element={
                <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
                  <h1 className="text-4xl font-serif text-brand-stone mb-4">404</h1>
                  <p className="text-brand-stone/60 mb-8">Página não encontrada no React SPA.</p>
                  <a href="/" className="px-6 py-2 bg-brand-rose text-white rounded-full">Voltar ao início</a>
                </div>
              } />
                </Routes>
              </React.Suspense>
              </AppErrorBoundary>
              <Toaster 
                position="top-center" 
                toastOptions={{
                  style: {
                    background: 'var(--color-brand-white)',
                    border: '1px solid var(--color-brand-mist)',
                    color: 'var(--color-brand-ink)',
                    borderRadius: '24px',
                    fontSize: '13px',
                    fontWeight: '400',
                    fontFamily: 'Outfit, sans-serif',
                    padding: '12px 20px',
                    boxShadow: '0 20px 40px -10px rgba(24, 18, 14, 0.08)',
                  },
                }}
              />
            </div>
        </Router>
        </PendingAppointmentsProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}
