import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { OnboardingPage } from './pages/OnboardingPage';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/p/:slug" element={<PublicProfilePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/" element={<div className="p-8"><h1>Nera Professional</h1><p>Acesse /login para entrar ou /p/seu-slug para o perfil público.</p></div>} />
      </Routes>
    </Router>
  );
}

export default App;
