import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { User, Mail, Lock, ArrowRight, Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { toast } from 'sonner';
import { generateSlug, getHumanError } from '../lib/utils';
import Logo from '../components/Logo';

export default function RegisterPage() {
  const { user: currentUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleRegister = async () => {
    setLoading(true);
    console.log('>>> [DEBUG] [Register] Início do cadastro com Google');
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const slug = generateSlug(user.displayName || 'profissional');
      
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
          createdAt: new Date().toISOString()
        }, { merge: true });
      } catch (firestoreError) {
        handleFirestoreError(firestoreError, OperationType.WRITE, `users/${user.uid}`);
      }

      toast.success('Que prazer ter você conosco! Bem-vinda à Nera.');
      setTimeout(() => navigate('/onboarding'), 500);

    } catch (error: any) {
      console.error('>>> [DEBUG] [Register] Erro no cadastro Google:', error);
      if (error.code === 'auth/popup-blocked') {
        toast.error('O acesso foi bloqueado pelo navegador. Por favor, permita popups.');
      } else {
        toast.error('Não foi possível realizar o cadastro agora. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    console.log('>>> [DEBUG] [Register] Início do processo de cadastro manual');
    
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      try {
        await updateProfile(user, { displayName: name });
      } catch (updateError) {
        console.warn('>>> [DEBUG] [Register] Erro ao atualizar displayName:', updateError);
      }
      
      const slug = generateSlug(name);
      
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
          createdAt: new Date().toISOString()
        });
      } catch (firestoreError) {
        handleFirestoreError(firestoreError, OperationType.WRITE, `users/${user.uid}`);
      }

      toast.success('Perfil criado com sucesso. Vamos começar?');
      setTimeout(() => navigate('/onboarding'), 500);

    } catch (error: any) {
      console.error('>>> [DEBUG] [Register] ERRO NO CADASTRO:', error);
      toast.error('Não foi possível concluir agora. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutAndStay = async () => {
    await signOut(auth);
    toast.success('Até breve!');
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
          <h2 className="text-3xl font-serif font-normal text-brand-ink mb-2">Sua nova era</h2>
          <p className="text-brand-stone text-sm font-light">Inicie sua presença premium agora.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-5 mb-10">
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-brand-stone uppercase tracking-widest ml-1">Seu Nome</label>
            <div className="relative">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-mist" size={18} />
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

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-brand-terracotta text-brand-white py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-sienna transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
          >
            {loading ? 'Preparando sua experiência...' : 'Iniciar Minha Marca'} <ArrowRight size={18} />
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
          Google Account
        </button>

        <p className="text-center mt-10 text-sm text-brand-stone font-light">
          Já tem uma conta? <Link to="/login" className="text-brand-terracotta font-medium hover:underline">Fazer login</Link>
        </p>
      </motion.div>
    </div>
  );
}
