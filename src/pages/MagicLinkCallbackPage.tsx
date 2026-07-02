import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { auth } from '../firebase';
import { motion } from 'motion/react';
import { CheckCircle, XCircle, Loader2, Mail, ArrowRight, Sparkles } from 'lucide-react';
import { notify } from '../lib/notify';
import Logo from '../components/Logo';

type CallbackStatus = 'loading' | 'success' | 'error' | 'needsEmail';

const isDev = import.meta.env.DEV || (typeof window !== 'undefined' && window.location.hostname.includes('ais-'));

export default function MagicLinkCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [btnLoading, setBtnLoading] = useState(false);

  const returnUrl = searchParams.get('returnUrl') || '/dashboard';

  // Extract name from email prefix nicely (e.g. maria.silva -> Maria Silva)
  const deriveNameFromEmail = (emailStr: string): string => {
    if (!emailStr) return "Usuária Nera";
    const part = emailStr.split('@')[0];
    const clean = part.replace(/[._-]/g, ' ');
    return clean
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const ensureUserRegisteredInFirestore = async (firebaseUser: any) => {
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          name: firebaseUser.displayName || deriveNameFromEmail(firebaseUser.email || ""),
          email: firebaseUser.email || "",
        }),
      });

      if (response.ok) {
        if (isDev) console.log("[MagicLink] Auto-registration succeeded.");
      } else {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 409 || errData.code === "USER_ALREADY_EXISTS") {
          if (isDev) console.log("[MagicLink] User already exists in Firestore.");
        } else {
          console.warn("[MagicLink] Firestore registration non-blocking warning:", errData.error);
        }
      }
    } catch (err) {
      console.error("[MagicLink] Failed to ensure Firestore registration:", err);
    }
  };

  const handleSignIn = async (emailToUse: string) => {
    try {
      setStatus('loading');
      const cleanEmail = emailToUse.trim().toLowerCase();
      
      const result = await signInWithEmailLink(auth, cleanEmail, window.location.href);
      
      // Clear email from storage
      window.localStorage.removeItem('emailForSignIn');

      // Ensure user has a profile document in Firestore
      if (result.user) {
        await ensureUserRegisteredInFirestore(result.user);
      }

      setStatus('success');
      notify.success('Seja bem-vinda.');
      
      // Brief delay before redirecting to allow user to see success state
      setTimeout(() => {
        navigate(returnUrl);
      }, 2000);

    } catch (err: any) {
      if (isDev) console.error('[MagicLinkCallback] Sign-in error:', err);
      setStatus('error');
      
      if (err.code === 'auth/expired-action-code') {
        setErrorMsg('Este link de acesso expirou. Solicite um novo link.');
      } else if (err.code === 'auth/invalid-action-code') {
        setErrorMsg('Este link de acesso é inválido ou já foi utilizado.');
      } else {
        setErrorMsg('Ocorreu um erro ao validar seu acesso. Verifique seu e-mail e tente novamente.');
      }
    }
  };

  useEffect(() => {
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setStatus('error');
      setErrorMsg('Este link de acesso não é válido para login por e-mail.');
      return;
    }

    // Try to get email from localStorage
    const savedEmail = window.localStorage.getItem('emailForSignIn');
    if (savedEmail) {
      handleSignIn(savedEmail).catch(() => {});
    } else {
      setStatus('needsEmail');
    }
  }, []);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBtnLoading(true);
    handleSignIn(email).finally(() => {
      setBtnLoading(false);
    });
  };

  return (
    <div className="min-h-screen bg-brand-parchment flex flex-col items-center justify-center p-6 text-brand-ink relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 border border-brand-ink rounded-full" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] border border-brand-ink rounded-full" />
      </div>

      <Link to="/" className="mb-12 relative z-10">
        <Logo className="scale-110" />
      </Link>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-brand-white p-10 rounded-[40px] border border-brand-mist shadow-2xl text-center relative z-10"
      >
        {status === 'loading' && (
          <div className="py-10">
            <div className="w-20 h-20 bg-[#FAF9F8] border border-brand-mist/40 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-sm">
              <Loader2 className="w-8 h-8 text-brand-ink animate-spin" strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-serif mb-2 italic">Validando seu acesso</h2>
            <p className="text-[11px] text-brand-stone font-light uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
              Autenticando sua assinatura segura...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6">
            <div className="w-20 h-20 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-6 mx-auto">
              <Sparkles size={40} className="text-brand-terracotta animate-pulse" />
            </div>
            <h2 className="text-2xl font-serif mb-4">Acesso concedido!</h2>
            <p className="text-brand-stone font-light mb-8 leading-relaxed text-sm">
              Seja bem-vinda de volta à Nera. Estamos redirecionando você para o seu painel profissional...
            </p>
            <div className="w-12 h-1 bg-brand-terracotta/20 rounded-full mx-auto overflow-hidden">
              <motion.div 
                className="h-full bg-brand-terracotta"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.8 }}
              />
            </div>
          </div>
        )}

        {status === 'needsEmail' && (
          <div className="py-6 text-left">
            <h2 className="text-2xl font-serif text-brand-ink text-center mb-4">Confirme seu E-mail</h2>
            <p className="text-brand-stone font-light text-center mb-8 text-sm leading-relaxed">
              Por motivos de segurança, como você abriu este link em outro navegador ou dispositivo, confirme o e-mail que solicitou o acesso.
            </p>
            
            <form onSubmit={handleEmailSubmit} className="space-y-6">
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

              <button 
                type="submit"
                disabled={btnLoading}
                className="w-full bg-brand-ink text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {btnLoading ? 'Confirmando...' : 'Completar Acesso'} <ArrowRight size={18} />
              </button>
            </form>
          </div>
        )}

        {status === 'error' && (
          <div className="py-6">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-6 mx-auto">
              <XCircle size={40} />
            </div>
            <h2 className="text-2xl font-serif mb-4">Não foi possível acessar</h2>
            <p className="text-brand-stone font-light mb-10 leading-relaxed text-sm">
              {errorMsg}
            </p>
            
            <div className="flex flex-col gap-4">
              <Link 
                to="/login"
                className="w-full bg-brand-ink text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3"
              >
                Tentar Novamente <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        )}
      </motion.div>

      <p className="mt-12 text-[10px] text-brand-stone font-light uppercase tracking-widest">
        Nera · Gestão Premium
      </p>
    </div>
  );
}
