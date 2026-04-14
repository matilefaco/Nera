import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { Calendar, Mail, Lock, ArrowRight, Sparkles, LogOut } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { toast } from 'sonner';

export default function LoginPage() {
  const { user: currentUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    console.log('[Login] Iniciando login com Google...');
    try {
      const provider = new GoogleAuthProvider();
      console.log('[Login] Abrindo popup do Google...');
      await signInWithPopup(auth, provider);
      console.log('[Login] Login Google bem-sucedido.');
      toast.success('Bem-vinda de volta!');
      console.log('[Login] Redirecionando para dashboard...');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('[Login] Erro no login Google:', error);
      if (error.code === 'auth/popup-blocked') {
        toast.error('O popup foi bloqueado pelo navegador.');
      } else if (error.message?.includes('security cookie') || error.code === 'auth/internal-error') {
        toast.error('Erro de segurança do Safari. Tente abrir em uma nova aba.');
      } else {
        toast.error('Erro ao entrar com Google: ' + (error.message || 'Erro desconhecido'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    console.log('[Login] Iniciando login manual...');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log('[Login] Login manual bem-sucedido.');
      toast.success('Bem-vinda de volta!');
      console.log('[Login] Redirecionando para dashboard...');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('[Login] Erro no login manual:', error);
      toast.error('E-mail ou senha incorretos');
    } finally {
      setLoading(false);
      console.log('[Login] Fluxo finalizado (loading=false)');
    }
  };

  const handleLogoutAndStay = async () => {
    await signOut(auth);
    toast.info('Sessão encerrada.');
  };

  return (
    <div className="min-h-screen bg-brand-cream/30 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Blur */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-rose/10 rounded-full blur-[100px] -z-10" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-rose/5 rounded-full blur-[100px] -z-10" />

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
              Você já está logada como {currentUser.displayName || currentUser.email}. Deseja entrar com outra conta?
            </p>
            <div className="flex flex-col w-full gap-4">
              <button 
                onClick={handleLogoutAndStay}
                className="w-full bg-brand-dark text-white py-5 rounded-2xl font-bold text-xs uppercase tracking-widest premium-shadow"
              >
                Sair e trocar de conta
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

        <div className="absolute -top-4 -right-4 w-12 h-12 bg-brand-rose text-white rounded-2xl flex items-center justify-center shadow-lg rotate-12">
          <Sparkles size={24} />
        </div>

        <h2 className="text-3xl font-serif italic font-bold mb-2 text-brand-dark">Bem-vinda de volta</h2>
        <p className="text-brand-gray text-sm mb-10 font-medium">Sua agenda boutique está esperando por você.</p>

        <form onSubmit={handleEmailLogin} className="space-y-6 mb-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Seu E-mail</label>
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
            <label className="text-[10px] font-bold text-brand-gray uppercase tracking-widest ml-1">Sua Senha</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-brand-gray" size={20} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-14 pr-6 py-4 bg-brand-cream border-none rounded-2xl focus:ring-2 focus:ring-brand-rose/20 outline-none transition-all text-brand-dark"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-brand-dark text-white py-5 rounded-2xl font-bold text-lg hover:bg-brand-dark/90 transition-all flex items-center justify-center gap-3 premium-shadow disabled:opacity-50"
          >
            {loading ? 'Acessando...' : 'Entrar no Estúdio'} <ArrowRight size={22} />
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
          onClick={handleGoogleLogin}
          className="w-full bg-white border border-brand-rose/20 text-brand-dark py-4 rounded-2xl font-bold hover:bg-brand-cream transition-all flex items-center justify-center gap-4 shadow-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          Google Account
        </button>

        <p className="text-center mt-10 text-sm text-brand-gray font-medium">
          Ainda não tem sua agenda? <Link to="/register" className="text-brand-rose font-bold hover:underline">Criar agora</Link>
        </p>
      </motion.div>
    </div>
  );
}
