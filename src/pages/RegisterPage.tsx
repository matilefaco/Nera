import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { User as UserIcon, Mail, Lock, ArrowRight, Sparkles, LogOut, Gift } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { notify } from '../lib/notify';
import { generateSlug, getHumanError, generateReferralCode } from '../lib/utils';
import Logo from '../components/Logo';

export default function RegisterPage() {
  const { user: currentUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [manualReferralCode, setManualReferralCode] = useState(searchParams.get('ref') || '');
  const selectedPlan = searchParams.get('plan');

    const handlePostRegisterCheckout = async (user: User, email: string) => {
    if (!selectedPlan || (selectedPlan !== 'essencial' && selectedPlan !== 'pro')) {
      navigate('/onboarding');
      return;
    }

    console.log('[SIGNUP FLOW DEBUG] selectedPlan:', selectedPlan);
    console.log('[SIGNUP FLOW DEBUG] user.uid exists:', !!user.uid);
    console.log('[SIGNUP FLOW DEBUG] user.email exists:', !!user.email);

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/plans/create-checkout', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plan: selectedPlan,
          professionalId: user.uid,
          email: email,
        }),
      });

      const data = await response.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        const errorMsg = data.details || data.error || 'Erro ao iniciar checkout do plano selecionado.';
        console.error('[SIGNUP FLOW ERROR] Server response:', errorMsg);
        notify.error(errorMsg, undefined, { duration: 6000 });
        navigate('/onboarding');
      }
    } catch (err: any) {
      console.error('[SIGNUP FLOW FETCH ERROR]:', err);
      notify.error(err, 'Erro de conexão ao iniciar checkout.');
      navigate('/onboarding');
    }
  };

  const handleGoogleRegister = async () => {
    setLoading(true);
    console.log('[SIGNUP FLOW] Starting with Google');
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log('[SIGNUP FLOW] Auth success (Google):', user.uid);
      
      const slug = generateSlug(user.displayName || 'profissional');
      const userReferralCode = generateReferralCode(user.displayName || 'PROFISSIONAL');
      
      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          slug,
          specialty: '',
          bio: '',
          location: '',
          whatsapp: '',
          avatar: user.photoURL || '',
          onboardingCompleted: false,
          referredBy: manualReferralCode || null,
          referralCode: userReferralCode,
          credits: 0,
          createdAt: new Date().toISOString()
        }, { merge: true });
        console.log('[SIGNUP FLOW] Profile creation success (Google)');
      } catch (firestoreError: any) {
        console.error('[SIGNUP FLOW] Firestore profile creation failed:', firestoreError);
        handleFirestoreError(firestoreError, OperationType.WRITE, `users/${user.uid}`);
      }

      console.log('[SIGNUP FLOW] Completed (Google)');
      notify.success('Que prazer ter você conosco! Bem-vinda à Nera.', {
        icon: <Sparkles className="text-brand-terracotta" size={18} />
      });
      
      await handlePostRegisterCheckout(user, user.email || '');

    } catch (error: any) {
      console.error('[SIGNUP FLOW] Fatal error:', error);
      notify.error(error, "Não foi possível criar sua conta.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    console.log('[SIGNUP FLOW] Starting manual flow for:', email);
    
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('[SIGNUP FLOW] Auth success:', user.uid);
      
      try {
        await updateProfile(user, { displayName: name });
      } catch (updateError) {
        console.warn('[SIGNUP FLOW] Warning updating displayName:', updateError);
      }
      
      const slug = generateSlug(name);
      const userReferralCode = generateReferralCode(name);
      
      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name,
          email,
          slug,
          specialty: '',
          bio: '',
          location: '',
          whatsapp: '',
          avatar: '',
          onboardingCompleted: false,
          referredBy: manualReferralCode || null,
          referralCode: userReferralCode,
          credits: 0,
          createdAt: new Date().toISOString()
        });
        console.log('[SIGNUP FLOW] Firestore profile creation success');
      } catch (firestoreError: any) {
        console.error('[SIGNUP FLOW] Firestore creation failed:', firestoreError);
        handleFirestoreError(firestoreError, OperationType.WRITE, `users/${user.uid}`);
      }

      console.log('[SIGNUP FLOW] Completed manual registration');
      
      notify.success('Perfil criado com sucesso. Vamos começar?', {
        icon: <Sparkles className="text-brand-terracotta" size={18} />
      });
      
      await handlePostRegisterCheckout(user, email);

    } catch (error: any) {
      console.error('[SIGNUP FLOW] Manual registration error:', error);
      notify.error(error, "Não foi possível registrar.");
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
        {currentUser && !loading && (
          <div className="absolute inset-0 z-50 bg-brand-white/95 backdrop-blur-sm rounded-[40px] flex flex-col items-center justify-center p-10 text-center">
            <div className="w-20 h-20 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-6">
              <LogOut size={32} />
            </div>
            <h3 className="text-2xl font-serif font-normal text-brand-ink mb-4">Você já está conectada</h3>
            <p className="text-brand-stone text-sm mb-8 leading-relaxed font-light">
              Para criar uma nova vitrine premium, você precisa sair da conta atual ({currentUser.displayName || currentUser.email}).
            </p>
            <div className="flex flex-col w-full gap-3">
              <button 
                onClick={handleLogoutAndStay}
                className="w-full bg-brand-ink text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all"
              >
                Sair e criar nova conta
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
          <h2 className="text-3xl font-serif font-normal text-brand-ink mb-2">Crie sua presença profissional</h2>
          {selectedPlan === 'essencial' || selectedPlan === 'pro' ? (
            <p className="text-brand-stone text-sm font-light">Prepare-se para o próximo nível. <br/> Você selecionou o plano <span className="font-semibold text-brand-terracotta capitalize">{selectedPlan}</span>.</p>
          ) : (
            <p className="text-brand-stone text-sm font-light">Comece sua página de agendamento em minutos. <br/> Você começará no plano <span className="font-medium text-brand-terracotta">Gratuito</span>.</p>
          )}
        </div>

        <form onSubmit={handleRegister} className="space-y-5 mb-10">
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Seu Nome</label>
            <div className="relative">
              <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Qual o seu nome profissional?"
                className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] focus:ring-1 focus:ring-brand-ink outline-none transition-all text-brand-ink font-light"
                required
              />
            </div>
          </div>

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
            <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Crie uma Senha</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="No mínimo 6 caracteres"
                className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] focus:ring-1 focus:ring-brand-ink outline-none transition-all text-brand-ink font-light"
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Código de Indicação (Opcional)</label>
            <div className="relative">
              <Gift className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
              <input 
                type="text" 
                value={manualReferralCode}
                onChange={(e) => setManualReferralCode(e.target.value.toUpperCase())}
                placeholder="Ex: MARI2A"
                className="w-full pl-14 pr-6 py-4 bg-brand-parchment border border-brand-mist rounded-[20px] focus:ring-1 focus:ring-brand-ink outline-none transition-all text-brand-ink font-light uppercase"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-brand-terracotta text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-sienna transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
          >
            {loading ? 'Preparando seu perfil...' : 'Criar meu perfil'} <ArrowRight size={18} />
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
          onClick={handleGoogleRegister}
          className="w-full bg-brand-white border border-brand-mist text-brand-ink py-4 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all flex items-center justify-center gap-4"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Continuar com Google
        </button>

        <p className="text-center mt-10 text-sm text-brand-stone font-light">
          Já tem uma conta? <Link to="/login" className="text-brand-terracotta font-medium hover:underline">Fazer login</Link>
        </p>
      </motion.div>
    </div>
  );
}
