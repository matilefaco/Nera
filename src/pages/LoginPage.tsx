import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Mail, Lock, ArrowRight, Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { notify } from '../lib/notify';
import { getHumanError } from '../lib/utils';
import Logo from '../components/Logo';

export default function LoginPage() {
  const { user: currentUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    console.log('[LOGIN FLOW] Starting Google login');
    console.log('[LOGIN FLOW] Domain:', window.location.hostname);
    console.log('[LOGIN FLOW] Origin:', window.location.origin);
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      console.log('[LOGIN FLOW] Google success for user:', result.user.email);
      notify.success('Que bom ter você de volta!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('[LOGIN FLOW] Google login error:', error);
      console.error('[LOGIN FLOW] Error Code:', error.code);
      console.error('[LOGIN FLOW] Error Message:', error.message);
      
            notify.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    console.log('[LOGIN FLOW] Starting manual login for:', email);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log('[LOGIN FLOW] Manual success for user:', result.user.email);
      notify.success('Que bom ter você de volta!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('[LOGIN FLOW] Manual login error:', error);
      console.error('[LOGIN FLOW] Error Code:', error.code);
      console.error('[LOGIN FLOW] Error Message:', error.message);

            notify.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAndStay = async () => {
    await signOut(auth);
    notify.success('Até breve!');
  };

  return (
    <div className="min-h-screen bg-brand-parchment flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 border border-brand-ink rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] border border-brand-ink rounded-full" />
      </div>

      <Link to="/" className="mb-12">
        <Logo className="scale-110" />
      </Link>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-2xl relative"
      >
        {currentUser && !loading && (
          <div className="absolute inset-0 z-50 bg-brand-white/95 backdrop-blur-sm rounded-[40px] flex flex-col items-center justify-center p-10 text-center">
            <div className="w-20 h-20 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-6">
              <LogOut size={32} />
            </div>
            <h3 className="text-2xl font-serif font-normal text-brand-ink mb-4">Você já está conectada</h3>
            <p className="text-brand-stone text-sm mb-8 leading-relaxed font-light">
              Você já está logada como {currentUser.displayName || currentUser.email}. Deseja trocar de conta?
            </p>
            <div className="flex flex-col w-full gap-3">
              <button 
                onClick={handleLogoutAndStay}
                className="w-full bg-brand-ink text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all"
              >
                Sair e trocar de conta
              </button>
              <Link 
                to="/dashboard"
                className="w-full bg-brand-linen text-brand-ink py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-mist transition-all text-center"
              >
                Ir para meu Painel
              </Link>
            </div>
          </div>
        )}

        <div className="text-center mb-10">
          <h2 className="text-3xl font-serif font-normal text-brand-ink mb-2">Bem-vinda de volta</h2>
          <p className="text-brand-stone text-sm font-light">Sua presença profissional espera por você.</p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-6 mb-10">
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Seu E-mail</label>
            <div className="relative">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@estudio.com"
                className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] focus:ring-1 focus:ring-brand-ink outline-none transition-all text-brand-ink font-light"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Sua Senha</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] focus:ring-1 focus:ring-brand-ink outline-none transition-all text-brand-ink font-light"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-brand-ink text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? 'Acessando...' : 'Acessar Meu Painel'} <ArrowRight size={18} />
          </button>
        </form>

        <div className="relative mb-10">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-mist"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
            <span className="bg-brand-white px-4 text-brand-mist font-medium">Ou continue com</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin}
          className="w-full bg-brand-white border border-brand-mist text-brand-ink py-4 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all flex items-center justify-center gap-4"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Continuar com Google
        </button>

        <p className="text-center mt-10 text-sm text-brand-stone font-light">
          Ainda não tem seu perfil? <Link to="/register" className="text-brand-terracotta font-medium hover:underline">Criar agora</Link>
        </p>
      </motion.div>
    </div>
  );
}
