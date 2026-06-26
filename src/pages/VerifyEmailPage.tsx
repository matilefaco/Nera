import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../AuthContext';
import { notify } from '../lib/notify';
import { Mail, RefreshCw, LogOut, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import Logo from '../components/Logo';
import { isDemoEmail } from '../constants/demoAccounts';

export default function VerifyEmailPage() {
  const { user, profile, loading: authLoading, isAuthReady } = useAuth();
  const [searchParams] = useSearchParams();
  const isVerifiedSuccess = searchParams.get('verified') === '1';

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthReady && !authLoading) {
      if (!user) {
        navigate('/login');
      } else {
        const isDemoUser = (profile?.isDemo === true && profile?.demoProfile === 'studio-aurora') || isDemoEmail(user?.email);
        if (user.emailVerified || isDemoUser) {
          navigate('/dashboard');
        }
      }
    }
  }, [user, profile, authLoading, isAuthReady, navigate]);

  const handleReload = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await user.reload();
      if (auth.currentUser?.emailVerified) {
        notify.success('E-mail confirmado com sucesso!');
        navigate('/dashboard');
      } else {
        notify.info('O e-mail ainda não foi confirmado. Verifique sua caixa de entrada e spam.');
      }
    } catch (error: any) {
      console.error('[VerifyEmailPage] Error reloading user:', error);
      notify.error('Erro ao verificar status. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!user || !user.email) return;
    setResending(true);
    try {
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });

      if (response.ok) {
        notify.success('E-mail de verificação reenviado!');
      } else {
        notify.error('Erro ao reenviar e-mail.');
      }
    } catch (error: any) {
      console.error('[VerifyEmailPage] Error resending verification:', error);
      notify.error('Erro de conexão. Tente novamente.');
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('[VerifyEmailPage] Logout error:', error);
    }
  };

  if (!isAuthReady || !user) {
    return (
      <div className="min-h-screen bg-brand-parchment flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <Logo className="opacity-20 mb-4" />
          <div className="h-4 w-32 bg-brand-mist/20 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-parchment flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 border border-brand-ink rounded-full" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] border border-brand-ink rounded-full" />
      </div>

      <Link to="/" className="mb-12">
        <Logo className="scale-110" />
      </Link>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-2xl relative"
      >
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-6 mx-auto">
            {isVerifiedSuccess ? <Sparkles size={32} /> : <Mail size={32} />}
          </div>
          <h2 className="text-3xl font-serif font-normal text-brand-ink mb-4">
            {isVerifiedSuccess ? 'Tudo pronto!' : 'Confirme seu e-mail'}
          </h2>
          <p className="text-brand-stone text-sm font-light leading-relaxed">
            {isVerifiedSuccess 
              ? 'Seu e-mail foi confirmado com sucesso. Agora sua agenda está pronta para receber agendamentos.'
              : <>Enviamos um link de confirmação para <span className="font-medium text-brand-ink">{user.email}</span>. Por favor, verifique sua caixa de entrada (e a pasta de spam) para ativar sua conta.</>}
          </p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={isVerifiedSuccess ? () => navigate('/dashboard') : handleReload}
            disabled={loading}
            className="w-full bg-brand-ink text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              isVerifiedSuccess ? <ArrowRight size={18} /> : <CheckCircle2 size={18} />
            )}
            {loading ? 'Verificando...' : (isVerifiedSuccess ? 'Ir para o Painel' : 'Já confirmei, continuar')}
          </button>

          {!isVerifiedSuccess && (
            <button 
              onClick={handleResend}
              disabled={resending}
              className="w-full bg-brand-linen text-brand-ink py-4 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-mist transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {resending ? (
                <RefreshCw className="animate-spin" size={16} />
              ) : (
                <Mail size={16} />
              )}
              {resending ? 'Enviando...' : 'Reenviar link de confirmação'}
            </button>
          )}

          <div className="pt-6 border-t border-brand-mist/50 mt-6 flex justify-center">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-brand-stone hover:text-brand-terracotta transition-colors text-[10px] uppercase tracking-widest font-medium"
            >
              <LogOut size={16} /> Sair da conta
            </button>
          </div>
        </div>

        <p className="text-center mt-10 text-[10px] text-brand-stone font-light uppercase tracking-widest">
          Nera · Sua vitrine profissional
        </p>
      </motion.div>
    </div>
  );
}
