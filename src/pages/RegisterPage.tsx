import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Calendar, User, Mail, Lock, ArrowRight, Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { toast } from 'sonner';
import { generateSlug } from '../lib/utils';

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
        console.log('>>> [DEBUG] [Register] Usuário já logado, encerrando sessão...');
        await signOut(auth);
      }

      const provider = new GoogleAuthProvider();
      console.log('>>> [DEBUG] [Register] Abrindo popup Google...');
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log('>>> [DEBUG] [Register] Google Auth sucesso. UID:', user.uid);
      
      const slug = generateSlug(user.displayName || 'profissional');
      
      console.log('>>> [DEBUG] [Register] Criando/Atualizando perfil no Firestore...');
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
        console.log('>>> [DEBUG] [Register] Perfil Firestore atualizado');
      } catch (firestoreError) {
        console.error('>>> [DEBUG] [Register] Erro Firestore Google:', firestoreError);
        handleFirestoreError(firestoreError, OperationType.WRITE, `users/${user.uid}`);
      }

      toast.success('Bem-vinda ao Marca Aí!');
      console.log('>>> [DEBUG] [Register] Redirecionando para /onboarding...');
      
      setTimeout(() => {
        navigate('/onboarding');
      }, 500);

    } catch (error: any) {
      console.error('>>> [DEBUG] [Register] Erro no cadastro Google:', error);
      if (error.code === 'auth/popup-blocked') {
        toast.error('O popup foi bloqueado pelo navegador.');
      } else if (error.message?.includes('security cookie') || error.code === 'auth/internal-error') {
        toast.error('Erro de segurança. Tente abrir em uma nova aba.');
      } else {
        toast.error('Erro ao cadastrar com Google: ' + (error.message || 'Erro desconhecido'));
      }
    } finally {
      setLoading(false);
      console.log('>>> [DEBUG] [Register] Fluxo Google encerrado. loading=false');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    console.log('>>> [DEBUG] [Register] Início do processo de cadastro manual');
    
    try {
      // 1. Limpeza de sessão (se houver)
      if (auth.currentUser) {
        console.log('>>> [DEBUG] [Register] Usuário já autenticado detectado. Tentando deslogar...');
        await signOut(auth);
        console.log('>>> [DEBUG] [Register] Logout concluído com sucesso');
      }

      // 2. Criação da conta no Firebase Auth
      console.log('>>> [DEBUG] [Register] Chamando createUserWithEmailAndPassword...');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('>>> [DEBUG] [Register] Conta criada no Firebase Auth. UID:', user.uid);
      
      // 3. Atualização do Perfil no Auth (Nome)
      console.log('>>> [DEBUG] [Register] Atualizando displayName no Auth...');
      try {
        await updateProfile(user, { displayName: name });
        console.log('>>> [DEBUG] [Register] displayName atualizado com sucesso');
      } catch (updateError) {
        console.warn('>>> [DEBUG] [Register] Erro ao atualizar displayName (não-crítico):', updateError);
      }
      
      const slug = generateSlug(name);
      
      // 4. Criação do Perfil no Firestore
      console.log('>>> [DEBUG] [Register] Criando documento no Firestore (users)...');
      try {
        const userDoc = {
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
        };
        
        console.log('>>> [DEBUG] [Register] Dados do documento:', userDoc);
        await setDoc(doc(db, 'users', user.uid), userDoc);
        console.log('>>> [DEBUG] [Register] Documento no Firestore criado com sucesso');
      } catch (firestoreError) {
        console.error('>>> [DEBUG] [Register] Erro ao gravar no Firestore:', firestoreError);
        handleFirestoreError(firestoreError, OperationType.WRITE, `users/${user.uid}`);
      }

      // 5. Finalização e Redirecionamento
      toast.success('Conta criada com sucesso!');
      console.log('>>> [DEBUG] [Register] Redirecionando para /onboarding...');
      
      // Pequeno delay para garantir que o estado do Auth se propague
      setTimeout(() => {
        navigate('/onboarding');
        console.log('>>> [DEBUG] [Register] navigate() chamado');
      }, 500);

    } catch (error: any) {
      console.error('>>> [DEBUG] [Register] ERRO CRÍTICO NO FLUXO:', error);
      
      let errorMessage = 'Erro desconhecido';
      if (error.code === 'auth/email-already-in-use') errorMessage = 'Este e-mail já está em uso.';
      else if (error.code === 'auth/invalid-email') errorMessage = 'E-mail inválido.';
      else if (error.code === 'auth/weak-password') errorMessage = 'A senha é muito fraca.';
      else errorMessage = error.message || String(error);

      toast.error('Erro ao criar conta: ' + errorMessage);
    } finally {
      setLoading(false);
      console.log('>>> [DEBUG] [Register] Fluxo encerrado. loading=false');
    }
  };

  const handleLogoutAndStay = async () => {
    await signOut(auth);
    toast.info('Sessão encerrada. Você pode criar uma nova conta agora.');
  };

  return (
    <div className="min-h-screen bg-brand-cream/30 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Blur */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-brand-rose/10 rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-brand-rose/5 rounded-full blur-[100px] -z-10" />

      <Link to="/" className="flex items-center gap-2.5 mb-12 group">
        <div className="w-12 h-12 bg-brand-rose rounded-[18px] flex items-center justify-center text-white shadow-xl shadow-brand-rose/20 group-hover:scale-110 transition-transform">
          <Calendar size={28} />
        </div>
        <span className="text-3xl font-serif italic font-bold tracking-tight text-brand-dark">Marca Aí</span>
      </Link>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white p-10 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(231,143,142,0.15)] border border-brand-rose/10 relative"
      >
        {currentUser && !loading && (
          <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm rounded-[3rem] flex flex-col items-center justify-center p-10 text-center">
            <div className="w-20 h-20 bg-brand-rose-light text-brand-rose rounded-3xl flex items-center justify-center mb-6">
              <LogOut size={40} />
            </div>
            <h3 className="text-2xl font-serif font-bold text-brand-dark mb-4">Você já está conectada</h3>
            <p className="text-brand-gray text-sm mb-8 leading-relaxed">
              Para criar uma nova conta boutique, você precisa sair da conta atual ({currentUser.displayName || currentUser.email}).
            </p>
            <div className="flex flex-col w-full gap-4">
              <button 
                onClick={handleLogoutAndStay}
                className="w-full bg-brand-dark text-white py-5 rounded-2xl font-bold text-xs uppercase tracking-widest premium-shadow"
              >
                Sair e criar nova conta
              </button>
              <Link 
                to="/dashboard"
                className="w-full bg-brand-cream text-brand-dark py-5 rounded-2xl font-bold text-xs uppercase tracking-widest"
              >
                Ir para meu Dashboard
              </Link>
            </div>
          </div>
        )}

        <div className="absolute -top-4 -left-4 w-12 h-12 bg-brand-dark text-white rounded-2xl flex items-center justify-center shadow-lg -rotate-12">
          <Sparkles size={24} />
        </div>

        <h2 className="text-3xl font-serif italic font-bold mb-2 text-brand-dark">Comece seu Estúdio</h2>
        <p className="text-brand-gray text-sm mb-10 font-medium">Crie sua agenda boutique em menos de 2 minutos.</p>

        <form onSubmit={handleRegister} className="space-y-5 mb-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Seu Nome</label>
            <div className="relative">
              <User className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-gray" size={20} />
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como quer ser chamada?"
                className="w-full pl-14 pr-6 py-4 bg-brand-cream border-none rounded-2xl focus:ring-2 focus:ring-brand-rose/20 outline-none transition-all text-brand-dark"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Seu MELHOR E-mail</label>
            <div className="relative">
              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-gray" size={20} />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@estudio.com"
                className="w-full pl-14 pr-6 py-4 bg-brand-cream border-none rounded-2xl focus:ring-2 focus:ring-brand-rose/20 outline-none transition-all text-brand-dark"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Crie uma Senha</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-gray" size={20} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="No mínimo 6 caracteres"
                className="w-full pl-14 pr-6 py-4 bg-brand-cream border-none rounded-2xl focus:ring-2 focus:ring-brand-rose/20 outline-none transition-all text-brand-dark"
                required
                minLength={6}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-brand-rose text-white py-5 rounded-2xl font-bold text-lg hover:bg-brand-rose/90 transition-all flex items-center justify-center gap-3 premium-shadow disabled:opacity-50 mt-4"
          >
            {loading ? 'Criando...' : 'Criar Minha Agenda'} <ArrowRight size={22} />
          </button>
        </form>

        <div className="relative mb-10">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-rose/10"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
            <span className="bg-white px-4 text-brand-gray font-bold">Ou continue com</span>
          </div>
        </div>

        <button 
          onClick={handleGoogleRegister}
          className="w-full bg-white border border-brand-rose/20 text-brand-dark py-4 rounded-2xl font-bold hover:bg-brand-cream transition-all flex items-center justify-center gap-4 shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          Google Account
        </button>

        <p className="text-center mt-10 text-sm text-brand-gray font-medium">
          Já tem uma conta? <Link to="/login" className="text-brand-rose font-bold hover:underline">Fazer login</Link>
        </p>
      </motion.div>
    </div>
  );
}
