import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Key, Shield, AlertCircle, CheckCircle2, ChevronLeft, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { updatePassword } from 'firebase/auth';
import { auth } from '../firebase';
import AppLayout from '../components/AppLayout';
import { notify } from '../lib/notify';

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (newPassword.length < 6) {
      setError('Use pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setSuccess(true);
        notify.success('Senha atualizada com segurança.');
        setTimeout(() => navigate('/configuracoes'), 2000);
      } else {
        throw new Error('Sessão expirada. Entre novamente.');
      }
    } catch (err: any) {
      console.error('Password update error:', err);
      
      if (err.code === 'auth/requires-recent-login') {
        setError('Por segurança, entre novamente na sua conta e tente trocar a senha outra vez.');
        notify.error('Login recente necessário para segurança.');
      } else {
        setError('Não foi possível atualizar sua senha agora. Tente novamente.');
        notify.error('Falha ao atualizar senha.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout activeRoute="settings">
      <div className="p-6 md:p-12 pb-32 md:pb-12 max-w-xl mx-auto w-full">
        <Link 
          to="/configuracoes" 
          className="inline-flex items-center gap-2 text-brand-stone hover:text-brand-ink text-[10px] font-bold uppercase tracking-widest mb-8 transition-colors group"
        >
          <ChevronLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Voltar
        </Link>

        <header className="mb-10">
          <div className="w-12 h-12 rounded-2xl bg-brand-linen flex items-center justify-center text-brand-terracotta mb-6 border border-brand-terracotta/10">
            <Key size={24} />
          </div>
          <h1 className="text-3xl font-serif font-normal text-brand-ink mb-3">Trocar Senha</h1>
          <p className="text-sm text-brand-stone font-light">Mantenha sua conta da Nera segura atualizando sua credencial de acesso.</p>
        </header>

        <AnimatePresence mode="wait">
          {success ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-green-50 border border-green-100 p-8 rounded-3xl text-center space-y-4"
            >
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-green-500 mx-auto shadow-sm border border-green-100">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-serif text-brand-ink">Senha atualizada!</h2>
              <p className="text-sm text-brand-stone font-light">Sua nova senha já está ativa. Estamos te redirecionando...</p>
            </motion.div>
          ) : (
            <motion.form 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onSubmit={handleSubmit} 
              className="space-y-6"
            >
              {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-800 text-xs animate-in fade-in slide-in-from-top-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <p className="font-medium leading-relaxed">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest ml-1">Nova Senha</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-5 py-3.5 bg-brand-white border border-brand-mist rounded-2xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm shadow-sm"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-stone hover:text-brand-ink transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-brand-stone uppercase tracking-widest ml-1">Confirmar Nova Senha</label>
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Repita a nova senha"
                    className="w-full px-5 py-3.5 bg-brand-white border border-brand-mist rounded-2xl outline-none focus:ring-1 focus:ring-brand-ink transition-all font-light text-sm shadow-sm"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-brand-ink text-brand-white py-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all duration-300 ease-out flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-xl hover:scale-[1.01] active:scale-[0.98]"
                >
                  {loading ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Shield size={16} /> Atualizar Senha
                    </>
                  )}
                </button>
                
                <p className="mt-6 text-[10px] text-brand-stone text-center italic font-light">
                  Se você esqueceu sua senha atual, use a opção "Esqueci minha senha" na tela de login.
                </p>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
