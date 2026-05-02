import React from 'react';
import { motion } from 'motion/react';
import { XCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function CheckoutCanceledPage() {
  return (
    <div className="min-h-screen bg-[#FDFCFB] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[32px] p-10 shadow-[0_32px_64px_rgba(0,0,0,0.05)] border border-brand-stone/10 text-center"
      >
        <div className="w-20 h-20 bg-brand-terracotta/10 rounded-full flex items-center justify-center mx-auto mb-8">
          <XCircle size={40} className="text-brand-terracotta" />
        </div>

        <h1 className="text-3xl font-serif text-brand-ink mb-4">Pagamento cancelado</h1>
        
        <p className="text-brand-stone text-sm font-light leading-relaxed mb-10">
          O processo de checkout foi interrompido. Nenhuma cobrança foi realizada.
          Você pode escolher um plano novamente quando estiver pronta.
        </p>

        <div className="space-y-4">
          <Link 
            to="/planos"
            className="w-full h-14 flex items-center justify-center bg-brand-terracotta text-white rounded-full text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-sienna transition-all group"
          >
            <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            Voltar aos planos
          </Link>
        </div>

        <div className="mt-10 pt-8 border-top border-brand-stone/5">
          <p className="text-[10px] text-brand-stone/50 font-bold uppercase tracking-widest">
            Dúvidas? Entre em contato com nosso suporte.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
