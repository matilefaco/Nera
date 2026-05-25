import React from 'react';
import { motion } from 'motion/react';
import { Lock, LogOut } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export function DeleteAccountState() {
  const handleSignOut = () => {
    signOut(auth).then(() => {
      window.location.href = '/login';
    });
  };

  return (
    <div className="min-h-screen bg-brand-linen flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-brand-white rounded-[32px] p-8 md:p-10 shadow-sm border border-brand-mist text-center"
      >
        <div className="w-16 h-16 bg-brand-terracotta/10 text-brand-terracotta rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock size={32} strokeWidth={1.5} />
        </div>

        <h1 className="text-2xl font-serif text-brand-ink mb-4">
          Sua conta está em processo de exclusão
        </h1>

        <p className="text-[15px] font-sans text-brand-stone leading-relaxed mb-6">
          Recebemos o seu pedido com segurança. A sua vitrine já foi removida da experiência pública da Nera e o acesso às áreas da conta foi protegido enquanto concluímos o processo.
        </p>

        <div className="p-4 bg-brand-mist/30 rounded-2xl mb-8">
          <p className="text-sm text-brand-stone leading-relaxed">
            Enviamos um e-mail com os próximos passos. Se a solicitação foi feita por engano, responda a esse e-mail para que nossa equipe possa avaliar a reversão.
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full h-12 bg-brand-terracotta text-brand-white rounded-xl font-medium tracking-wide flex items-center justify-center hover:bg-brand-rust transition-colors"
        >
          <LogOut size={18} className="mr-2" />
          Sair com segurança
        </button>
      </motion.div>
    </div>
  );
}
