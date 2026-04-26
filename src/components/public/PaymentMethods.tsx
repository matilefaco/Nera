import React from 'react';
import { motion } from 'motion/react';
import { CreditCard, Wallet, Banknote, Landmark, CheckCircle2 } from 'lucide-react';

interface PaymentMethodsProps {
  className?: string;
  professionalName?: string;
}

export function PaymentMethods({ className, professionalName }: PaymentMethodsProps) {
  const methods = [
    { name: 'Pix' },
    { name: 'Crédito' },
    { name: 'Débito' },
    { name: 'Dinheiro' },
  ];

  return (
    <section className={`py-12 px-6 bg-brand-white border-y border-brand-mist/20 ${className}`}>
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">
        <div className="text-center space-y-1">
          <h3 className="text-[13px] font-bold uppercase tracking-[0.3em] text-brand-ink">Pagamento aceito</h3>
          <p className="text-[10px] text-brand-stone font-light italic">Seu atendimento pode ser pago no local {professionalName ? `com ${professionalName.split(' ')[0]}` : ''}.</p>
        </div>

        <div className="flex flex-wrap justify-center items-center gap-3 md:gap-4">
          {methods.map((method, i) => (
            <motion.div 
              key={method.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center px-5 py-2.5 bg-brand-parchment/30 rounded-full border border-brand-mist/40 transition-colors hover:border-brand-terracotta/20"
            >
              <CheckCircle2 size={10} className="text-brand-terracotta mr-2 opacity-50" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-brand-ink/80">{method.name}</span>
            </motion.div>
          ))}
          
          <div className="h-4 w-px bg-brand-mist mx-2 hidden md:block" />
          
          <div className="flex items-center gap-1.5 px-4 py-2 bg-brand-linen/40 rounded-full border border-brand-mist/50">
            <span className="text-[8px] font-bold uppercase tracking-widest text-brand-terracotta/70">Parcelamento disponível no cartão</span>
          </div>
        </div>
      </div>
    </section>
  );
}
