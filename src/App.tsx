import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { OnboardingPage } from './pages/OnboardingPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/p/:slug" element={<PublicProfilePage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/" element={<div className="p-8"><h1>Nera Professional Dashboard</h1><p>Acesse /p/seu-slug para ver o perfil público ou /onboarding para configurar seu perfil.</p></div>} />
      </Routes>
    </Router>
  );
}

export default App;
