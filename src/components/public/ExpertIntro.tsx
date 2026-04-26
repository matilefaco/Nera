import React from 'react';
import { motion } from 'motion/react';
import { Star, Award, Users, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../../types';

interface ExpertIntroProps {
  profile: UserProfile;
  stats?: any;
  customBio?: string;
}

export function ExpertIntro({ profile, stats, customBio }: ExpertIntroProps) {
  return (
    <section className="py-24 px-6 bg-brand-white relative overflow-hidden">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col items-center text-center space-y-10">
          {/* Text Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <motion.span 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-terracotta"
              >
                Garantia de Qualidade
              </motion.span>
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-4xl md:text-5xl font-serif text-brand-ink leading-tight"
              >
                Excelência e <em className="italic">Precisão</em>
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-brand-stone font-light leading-relaxed max-w-2xl mx-auto italic text-lg"
              >
                {customBio || profile.bio || 'Dedicada a realçar sua melhor versão com naturalidade.'}
              </motion.p>
            </div>

            {/* Differentials Badges */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap justify-center gap-4"
            >
              {profile.professionalIdentity?.differentials?.map((diff, i) => (
                <div key={i} className="bg-brand-linen/40 px-6 py-4 rounded-3xl flex items-center gap-3 border border-brand-mist/50">
                  <div className="w-2 h-2 rounded-full bg-brand-terracotta" />
                  <div className="text-[11px] font-bold uppercase tracking-widest text-brand-ink">{diff}</div>
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-2 text-brand-terracotta/70 pt-4"
            >
              <ShieldCheck size={14} />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Profissional Certificada Nera</span>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
