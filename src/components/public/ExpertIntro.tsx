import React from 'react';
import { motion } from 'motion/react';
import { Star, Award, Users, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../../types';

interface ExpertIntroProps {
  profile: UserProfile;
  stats?: any;
}

export function ExpertIntro({ profile, stats }: ExpertIntroProps) {
  return (
    <section className="py-24 px-6 bg-brand-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-20">
          {/* Professional Photo */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="w-64 h-80 md:w-72 md:h-96 rounded-[60px] overflow-hidden shadow-2xl z-10 relative">
              <img 
                src={profile.avatar || "https://images.unsplash.com/photo-1607008829749-c0f284a49fc4?auto=format&fit=crop&w=800&q=80"} 
                alt={profile.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            {/* Decorative Elements */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-brand-linen rounded-[40px] -z-10" />
            <div className="absolute -top-6 -left-6 w-48 h-48 bg-brand-parchment rounded-full blur-3xl -z-10" />
          </motion.div>

          {/* Text Content */}
          <div className="flex-1 text-center md:text-left space-y-8">
            <div className="space-y-4">
              <motion.span 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-[10px] font-bold uppercase tracking-[0.4em] text-brand-terracotta"
              >
                Especialista
              </motion.span>
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-4xl md:text-5xl font-serif text-brand-ink leading-tight"
              >
                {profile.name}
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-brand-stone font-light leading-relaxed max-w-xl mx-auto md:mx-0 italic"
              >
                {profile.headline || profile.specialty || 'Especialista em beleza natural'}. {profile.professionalIdentity?.yearsExperience ? `${profile.professionalIdentity.yearsExperience} anos criando resultados sofisticados e naturais.` : 'Dedicada a realçar sua melhor versão com naturalidade.'}
              </motion.p>
            </div>

            {/* Badges */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap justify-center md:justify-start gap-4"
            >
              <div className="bg-brand-linen/40 px-5 py-3 rounded-2xl flex items-center gap-3 border border-brand-mist/50">
                <Users size={16} className="text-brand-terracotta" />
                <div className="text-left">
                  <div className="text-[14px] font-bold text-brand-ink">+{stats?.totalCompletedBookings || 150}</div>
                  <div className="text-[9px] uppercase tracking-widest text-brand-stone opacity-60">atendimentos</div>
                </div>
              </div>
              
              <div className="bg-brand-linen/40 px-5 py-3 rounded-2xl flex items-center gap-3 border border-brand-mist/50">
                <Star size={16} className="text-brand-terracotta fill-brand-terracotta" />
                <div className="text-left">
                  <div className="text-[14px] font-bold text-brand-ink">{stats?.averageRating || 4.9}</div>
                  <div className="text-[9px] uppercase tracking-widest text-brand-stone opacity-60">estrelas</div>
                </div>
              </div>

              <div className="bg-brand-linen/40 px-5 py-3 rounded-2xl flex items-center gap-3 border border-brand-mist/50">
                <Award size={16} className="text-brand-terracotta" />
                <div className="text-left">
                  <div className="text-[14px] font-bold text-brand-ink">{profile.professionalIdentity?.yearsExperience || '10+'} anos</div>
                  <div className="text-[9px] uppercase tracking-widest text-brand-stone opacity-60">experiência</div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center md:justify-start gap-2 text-emerald-600/70"
            >
              <ShieldCheck size={14} />
              <span className="text-[10px] font-medium uppercase tracking-widest">Profissional verificada Nera</span>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
