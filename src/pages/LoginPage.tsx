import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, sendSignInLinkToEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Mail, Lock, ArrowRight, Sparkles, LogOut, CheckCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { notify } from '../lib/notify';
import { getHumanError } from '../lib/utils';
import Logo from '../components/Logo';
import { isDemoEmail } from '../constants/demoAccounts';

export default function LoginPage() {
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const isResetSuccess = searchParams.get('reset_success') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkCooldown, setMagicLinkCooldown] = useState(0);
  const navigate = useNavigate();

  const startMagicLinkCooldown = () => {
    setMagicLinkCooldown(60);
    const interval = setInterval(() => {
      setMagicLinkCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

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
        console.log("[Auth] Auto-registration succeeded.");
      } else {
        const errData = await response.json().catch(() => ({}));
        if (response.status === 409 || errData.code === "USER_ALREADY_EXISTS") {
          console.log("[Auth] User already exists in Firestore.");
        } else {
          console.warn("[Auth] Firestore registration warning:", errData.error);
        }
      }
    } catch (err) {
      console.error("[Auth] Failed to ensure Firestore registration:", err);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setForgotSent(true);
        notify.success('Instruções enviadas.');
      } else {
        notify.error(data.error || 'Erro ao processar solicitação.');
      }
    } catch (err: any) {
      notify.error('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      notify.success('Seja bem-vinda.');
      
      if (result.user) {
        await ensureUserRegisteredInFirestore(result.user);
      }

      const returnUrl = searchParams.get('returnUrl');
      navigate(returnUrl || '/dashboard');
    } catch (error: any) {
      notify.error(getHumanError(error.code));
    } finally {
      setLoading(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      notify.error("Por favor, insira seu e-mail.");
      return;
    }
    if (loading || magicLinkCooldown > 0) return;

    setLoading(true);
    try {
      const returnUrl = searchParams.get('returnUrl') || '';
      const actionCodeSettings = {
        url: `${window.location.origin}/login-magic-callback${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`,
        handleCodeInApp: true,
      };
      
      await sendSignInLinkToEmail(auth, email.trim().toLowerCase(), actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email.trim().toLowerCase());
      
      setMagicLinkSent(true);
      notify.success('Link de acesso enviado!');
      startMagicLinkCooldown();
    } catch (error: any) {
      console.error('[MagicLink] Error sending link:', error);
      notify.error('Ocorreu um erro ao enviar o link. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    try {
      const authPromise = signInWithEmailAndPassword(auth, email, password);
      let timeoutId: any;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('TIMEOUT_FIREBASE')), 10000);
      });
      
      await Promise.race([authPromise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
      const user = auth.currentUser;
      
      // Check if user is a demo profile to bypass verification
      let isDemoUser = false;
      if (user) {
        if (isDemoEmail(user.email)) {
          isDemoUser = true;
        } else {
          try {
            const { getDoc, doc } = await import('firebase/firestore');
            const { db } = await import('../firebase');
            const profileDoc = await getDoc(doc(db, 'users', user.uid));
            if (profileDoc.exists()) {
              const data = profileDoc.data();
              if (data?.isDemo === true && data?.demoProfile === 'studio-aurora') {
                isDemoUser = true;
              }
            }
          } catch (err) {
            console.error('[LoginPage] Error checking demo status:', err);
          }
        }
      }
      
      // If user is not verified and logged in with password, redirect to verification
      if (user && !user.emailVerified && !isDemoUser && user.providerData.some(p => p.providerId === 'password')) {
        notify.info('Sua conta ainda não foi verificada. Verifique seu e-mail.');
        navigate('/verificar-email');
        setLoading(false);
        return;
      }

      notify.success('Seja bem-vinda.');
      const returnUrl = searchParams.get('returnUrl');
      navigate(returnUrl || '/dashboard');
    } catch (error: any) {
      if (error.message === 'TIMEOUT_FIREBASE') {
         notify.error('O login demorou muito para responder. Verifique sua conexão e tente novamente.');
      } else if (error.code === 'auth/user-disabled') {
         notify.error('Esta conta está em processo de exclusão ou foi desativada.');
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-login-credentials' || error.code === 'auth/user-not-found') {
         notify.error('E-mail ou senha inválidos.');
      } else if (error.code === 'auth/network-request-failed') {
         notify.error('Não conseguimos conectar agora. Verifique sua conexão e tente novamente.');
      } else if (error.code === 'auth/too-many-requests') {
         notify.error('Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.');
      } else {
         notify.error(getHumanError(error.code));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAndStay = async () => {
    try {
      await signOut(auth);
      notify.success('Até breve!');
    } catch (err) {
      console.error('[Logout] error:', err);
      notify.error('Erro ao sair. Tente novamente.');
    }
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
          <h2 className="text-3xl font-serif font-normal text-brand-ink mb-2">
            {showForgot ? 'Recuperar Acesso' : 'Bem-vinda de volta'}
          </h2>
          <p className="text-brand-stone text-sm font-light">
            {showForgot 
              ? 'Enviaremos instruções para seu e-mail.' 
              : 'Sua presença profissional espera por você.'}
          </p>
        </div>

        {isResetSuccess && !showForgot && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-700"
          >
            <CheckCircle size={20} className="flex-shrink-0" />
            <p className="text-xs font-medium">Sua senha foi redefinida com sucesso. Você já pode acessar sua conta.</p>
          </motion.div>
        )}

        {showForgot ? (
          <div className="space-y-6">
            {forgotSent ? (
              <div className="bg-brand-linen/50 p-8 rounded-[24px] border border-brand-mist text-center">
                <p className="text-brand-stone text-sm leading-relaxed mb-6 font-light">
                  Se o e-mail <strong>{email}</strong> estiver cadastrado, você receberá um link para criar uma nova senha em instantes.
                </p>
                <button 
                  onClick={() => { setShowForgot(false); setForgotSent(false); }}
                  className="text-[10px] font-medium text-brand-terracotta uppercase tracking-widest hover:underline"
                >
                  Voltar para o Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-6">
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

                <div className="flex flex-col gap-4">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-ink text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? 'Enviando...' : 'Enviar Link de Recuperação'} <ArrowRight size={18} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowForgot(false)}
                    className="text-[10px] font-medium text-brand-stone uppercase tracking-widest hover:text-brand-ink transition-colors"
                  >
                    Cancelar e voltar
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : useMagicLink ? (
          <div className="space-y-6">
            {magicLinkSent ? (
              <div className="bg-brand-linen/50 p-8 rounded-[24px] border border-brand-mist text-center">
                <Sparkles className="w-12 h-12 text-brand-terracotta mx-auto mb-4 animate-pulse" />
                <h3 className="text-lg font-serif mb-2">Verifique seu e-mail</h3>
                <p className="text-brand-stone text-xs leading-relaxed mb-6 font-light">
                  Enviamos um link seguro para <strong>{email}</strong>. Abra o link no seu dispositivo para acessar sua conta.
                </p>
                <div className="flex flex-col gap-4">
                  <button 
                    type="button"
                    disabled={magicLinkCooldown > 0}
                    onClick={handleSendMagicLink}
                    className="text-[10px] font-medium text-brand-terracotta uppercase tracking-widest hover:underline disabled:opacity-50"
                  >
                    {magicLinkCooldown > 0 ? `Reenviar link em ${magicLinkCooldown}s` : 'Não recebi o e-mail (Reenviar)'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setUseMagicLink(false); setMagicLinkSent(false); }}
                    className="text-[10px] font-medium text-brand-stone uppercase tracking-widest hover:text-brand-ink transition-colors"
                  >
                    Voltar para login com senha
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendMagicLink} className="space-y-6">
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

                <div className="flex flex-col gap-4">
                  <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-ink text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {loading ? 'Enviando...' : 'Receber link de acesso'} <ArrowRight size={18} />
                  </button>
                  <button 
                    type="button"
                    onClick={() => setUseMagicLink(false)}
                    className="text-[10px] font-medium text-brand-stone uppercase tracking-widest hover:text-brand-ink transition-colors"
                  >
                    Voltar para login com senha
                  </button>
                </div>
              </form>
            )}

            <div className="relative my-8">
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
          </div>
        ) : (
          <>
            <form onSubmit={handleEmailLogin} className="space-y-6 mb-8">
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
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest">Sua Senha</label>
                  <button 
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-[10px] font-medium text-brand-stone hover:text-brand-terracotta uppercase tracking-widest transition-colors"
                  >
                    Esqueci minha senha
                  </button>
                </div>
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

              <div className="flex flex-col gap-4">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-ink text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {loading ? 'Acessando...' : 'Acessar Meu Painel'} <ArrowRight size={18} />
                </button>
                
                <button 
                  type="button"
                  onClick={() => setUseMagicLink(true)}
                  className="text-[10px] font-medium text-brand-terracotta hover:text-brand-sienna uppercase tracking-widest transition-colors py-1"
                >
                  Entrar sem senha (receber link por e-mail)
                </button>
              </div>
            </form>

            <div className="relative mb-8">
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
          </>
        )}


        <p className="text-center mt-10 text-sm text-brand-stone font-light">
          Ainda não tem seu perfil? <Link to="/register" className="text-brand-terracotta font-medium hover:underline">Criar agora</Link>
        </p>
        
        <div className="mt-8 text-center border-t border-brand-mist/50 pt-8">
          <Link to="/" className="text-[10px] text-brand-stone hover:text-brand-terracotta uppercase tracking-[0.2em] font-medium transition-colors">
            Voltar para a página inicial
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
