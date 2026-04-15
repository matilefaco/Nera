import React from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate,
  useLocation
} from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './AuthContext';

// Pages (to be created)
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import ServicesPage from './pages/ServicesPage';
import ProfilePage from './pages/ProfilePage';
import ClientsPage from './pages/ClientsPage';
import AgendaPage from './pages/AgendaPage';
import PublicProfile from './pages/PublicProfile';
import OnboardingPage from './pages/OnboardingPage';
import ReviewPage from './pages/ReviewPage';

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center h-screen bg-brand-cream">Carregando...</div>;
  
  if (!user) {
    console.log('[Guard] No user found, redirecting to login');
    return <Navigate to="/login" />;
  }

  // CRITICAL: Single Source of Truth for Onboarding
  const locallyCompleted = sessionStorage.getItem(`onboarding_completed_${user.uid}`) === 'true';
  const isCompleted = profile?.onboardingCompleted === true || locallyCompleted;
  
  console.log('[Guard] Checking access:', {
    path: location.pathname,
    uid: user.uid,
    hasProfile: !!profile,
    isCompleted,
    locallyCompleted,
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
    <AuthProvider>
      <Router>
        <div className="min-h-screen font-sans selection:bg-brand-rose/20 selection:text-brand-rose">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/p/:slug" element={<PublicProfile />} />
            <Route path="/review/:token" element={<ReviewPage />} />
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
            <Route path="/profile" element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            } />
          </Routes>
          <Toaster position="top-center" richColors />
        </div>
      </Router>
    </AuthProvider>
  );
}
