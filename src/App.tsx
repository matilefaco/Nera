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
import AppLoadingScreen from './components/AppLoadingScreen';

// Pages (to be created)
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import ServicesPage from './pages/ServicesPage';
import ProfilePage from './pages/ProfilePage';
import ClientsPage from './pages/ClientsPage';
import PlansPage from './pages/PlansPage';
import AgendaPage from './pages/AgendaPage';
import PublicProfile from './pages/PublicProfile';
import OnboardingPage from './pages/OnboardingPage';
import ReviewPage from './pages/ReviewPage';
import BookingResponsePage from './pages/BookingResponsePage';
import PendingRequestsPage from './pages/PendingRequestsPage';
import ManageBookingPage from './pages/ManageBookingPage';
import CouponsPage from './pages/CouponsPage';
import WhatsAppSimulator from './pages/WhatsAppSimulator';
import DirectoryPage from './pages/DirectoryPage';
import CheckoutSuccessPage from './pages/CheckoutSuccessPage';
import CheckoutCanceledPage from './pages/CheckoutCanceledPage';
import ReferralsPage from './pages/ReferralsPage';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AppLoadingScreen />;
  
  if (!user) {
    console.log('[Guard] No user found, redirecting to login');
    return <Navigate to="/login" />;
  }

  // CRITICAL: Single Source of Truth for Onboarding
  const isCompleted = profile?.onboardingCompleted === true;
  
  console.log('[Guard] Checking access:', {
    path: location.pathname,
    uid: user.uid,
    hasProfile: !!profile,
    isCompleted,
    step: profile?.onboardingStep
  });

  // If user is logged in but hasn't finished onboarding, redirect to onboarding
  if (profile && !isCompleted && location.pathname !== '/onboarding') {
    console.log('[Guard] Onboarding incomplete, forcing redirect to /onboarding');
    return <Navigate to="/onboarding" />;
  }

  // If user HAS finished onboarding and tries to go back to onboarding, send to dashboard
  if (isCompleted && location.pathname === '/onboarding') {
    console.log('[Guard] Onboarding already completed, forcing redirect to /dashboard');
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen font-sans selection:bg-brand-rose/20 selection:text-brand-rose">
            <Routes>
              {/* ... routes ... */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/p/:slug" element={<PublicProfile />} />
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
              <Route path="/profile" element={
                <PrivateRoute>
                  <ProfilePage />
                </PrivateRoute>
              } />
              <Route path="/admin/whatsapp-test" element={
                <PrivateRoute>
                  <WhatsAppSimulator />
                </PrivateRoute>
              } />
              <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
              <Route path="/checkout/canceled" element={<CheckoutCanceledPage />} />
              <Route path="/indicacoes" element={
                <PrivateRoute>
                  <ReferralsPage />
                </PrivateRoute>
              } />
            </Routes>
            <Toaster position="top-center" richColors />
          </div>
        </Router>
      </AuthProvider>
    </HelmetProvider>
  );
}
