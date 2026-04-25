import React from 'react';
import { motion } from 'motion/react';
import { CreditCard, Wallet, Banknote, Landmark, CheckCircle2 } from 'lucide-react';

interface PaymentMethodsProps {
  className?: string;
  professionalName?: string;
}

export function PaymentMethods({ className, professionalName }: PaymentMethodsProps) {
  const methods = [
    { icon: <Landmark size={18} />, name: 'Pix' },
    { icon: <CreditCard size={18} />, name: 'Crédito' },
    { icon: <CreditCard size={18} />, name: 'Débito' },
    { icon: <Banknote size={18} />, name: 'Dinheiro' },
  ];

  return (
    <section className={`py-16 px-6 bg-brand-white border-y border-brand-mist/30 ${className}`}>
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="text-center md:text-left space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-terracotta">Pagamento</span>
            <h3 className="text-2xl font-serif text-brand-ink">Formas aceitas</h3>
            <p className="text-[11px] text-brand-stone font-light italic">Pague no dia do seu atendimento {professionalName ? `com ${professionalName.split(' ')[0]}` : ''}.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {methods.map((method, i) => (
              <motion.div 
                key={method.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 px-6 py-4 bg-brand-parchment/40 rounded-2xl border border-brand-mist/50 group hover:border-brand-terracotta/30 transition-all"
              >
                <div className="text-brand-terracotta group-hover:scale-110 transition-transform">
                  {method.icon}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">{method.name}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="mt-12 flex items-center justify-center gap-2 text-emerald-600/60"
        >
          <CheckCircle2 size={12} />
          <span className="text-[9px] font-bold uppercase tracking-widest">Reserva garantida com pagamento no local</span>
        </motion.div>
      </div>
    </section>
  );
}
