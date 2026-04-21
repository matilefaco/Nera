import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Zap, Instagram, ChevronRight, MapPin, Home, Users, Star } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import PremiumButton from '../PremiumButton';
import { UserProfile, Service } from '../../types';

interface PublicHeroProps {
  profile: UserProfile;
  services: Service[];
  nextSlot: { date: string; time: string } | null;
  onBookingClick: (service?: Service) => void;
  heroBio?: string;
  stats?: { averageRating: number; totalCompletedBookings: number } | null;
  isAgendaFull?: boolean;
  onWaitlistClick?: () => void;
}

export const PublicHero = ({ 
  profile, 
  services, 
  nextSlot, 
  onBookingClick, 
  heroBio,
  stats,
  isAgendaFull,
  onWaitlistClick
}: PublicHeroProps) => {
  const firstName = profile.name.split(' ')[0];
  const lastName = profile.name.split(' ').slice(1).join(' ');

  return (
    <section className="relative min-h-screen grid grid-cols-1 lg:grid-cols-2 overflow-hidden bg-brand-parchment">
      {/* Decorative vertical line */}
      <div className="absolute top-0 left-[48%] w-px h-full bg-gradient-to-b from-transparent via-brand-mist to-transparent hidden lg:block z-10 pointer-events-none" />

      {/* Content Side */}
      <div className="flex flex-col justify-center px-6 md:px-16 pt-32 pb-24 lg:py-20 relative z-20 order-2 lg:order-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-10"
        >
          <div className="flex items-center gap-3 text-brand-terracotta">
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Profissional Verificada Nera</span>
          </div>

          <h1 className="display-hero text-brand-ink">
            {firstName}<br />
            <em className="font-serif italic text-brand-stone">{lastName}</em>
          </h1>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="w-8 h-px bg-brand-terracotta" />
              <span className="text-[11px] font-light uppercase tracking-[0.2em] text-brand-stone">
                {profile.headline || profile.specialty}
              </span>
            </div>

            <div className="flex items-center gap-3 text-brand-stone/60">
              {profile.serviceMode === 'home' ? <Home size={12} className="text-brand-terracotta" /> : <MapPin size={12} className="text-brand-terracotta" />}
              <span className="text-[10px] font-medium uppercase tracking-[0.18em]">
                {profile.city} • {profile.serviceMode === 'studio' ? 'Atendimento no Estúdio' : profile.serviceMode === 'home' ? 'Atendimento em Domicílio' : 'Estúdio & Domicílio'}
                {profile.serviceMode !== 'studio' && profile.serviceAreas && profile.serviceAreas.length > 0 && (
                  <>
                    <span className="mx-2 opacity-50">|</span>
                    {profile.serviceAreas.length <= 2 ? (
                      `Atende em: ${profile.serviceAreas.map(a => a.name).join(', ')}`
                    ) : (
                      `Atende em: ${profile.serviceAreas[0].name}, ${profile.serviceAreas[1].name} e +${profile.serviceAreas.length - 2} bairros`
                    )}
                  </>
                )}
                {profile.serviceMode !== 'studio' && profile.serviceAreaType === 'city_wide' && (
                  <>
                    <span className="mx-2 opacity-50">|</span>
                    Atende em toda a cidade
                  </>
                )}
              </span>
            </div>

            {stats && (stats.totalCompletedBookings > 10 || stats.averageRating > 4) && (
              <div className="flex flex-wrap gap-3">
                {stats.totalCompletedBookings > 10 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-brand-white border border-brand-mist rounded-full shadow-sm">
                    <Users size={12} className="text-brand-terracotta" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em]">
                      +{stats.totalCompletedBookings} atendimentos
                    </span>
                  </div>
                )}
                {stats.averageRating >= 4.5 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-brand-white border border-brand-mist rounded-full shadow-sm">
                    <Star size={12} className="text-brand-terracotta fill-brand-terracotta" />
                    <span className="text-[9px] font-bold uppercase tracking-[0.18em]">
                      {stats.averageRating.toFixed(1)} avaliação
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {nextSlot && (
            <div className="inline-flex items-center gap-3 bg-brand-white border border-brand-mist px-5 py-3 rounded-full shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-[0.18em]">
                Próximo horário: <span className="text-brand-terracotta">{nextSlot.date === new Date().toISOString().split('T')[0] ? 'hoje' : 'amanhã'} às {nextSlot.time}</span>
              </span>
            </div>
          )}

          <p className="body-text text-brand-stone max-w-sm">
            {heroBio || profile.bio || (profile.specialty ? `Especialista em ${profile.specialty} com foco em excelência e bem-estar.` : 'Atendimento personalizado com foco em resultados de alta qualidade.')}
          </p>

          <div className="flex flex-wrap items-center gap-6">
            <PremiumButton
              onClick={() => isAgendaFull ? onWaitlistClick?.() : onBookingClick(services[0])}
              variant="terracotta"
              className="px-10 py-5 text-[10px] tracking-[0.22em] shadow-xl"
            >
              {isAgendaFull ? 'Entrar na lista de espera' : 'Reservar agora'}
              <ChevronRight size={14} className="ml-2" />
            </PremiumButton>

            {profile.instagram && (
              <a
                href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-[10px] font-medium uppercase tracking-[0.15em] text-brand-stone hover:text-brand-ink transition-colors group"
              >
                <Instagram size={16} />
                <span className="border-b border-transparent group-hover:border-brand-stone transition-all">Ver Instagram</span>
              </a>
            )}
          </div>
        </motion.div>
      </div>

      {/* Visual Side */}
      <div className="relative flex items-center justify-center p-8 md:p-16 lg:p-24 order-1 lg:order-2 bg-brand-parchment lg:bg-transparent min-h-[70vh] lg:min-h-screen">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="relative w-full max-w-[420px] animate-drift"
        >
          {/* Organic Border SVG */}
          <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] z-10 pointer-events-none overflow-visible" viewBox="0 0 420 560" preserveAspectRatio="none">
            <path
              className="fill-none stroke-brand-terracotta/40 stroke-[1.5] animate-draw"
              d="M12,48 Q8,12 48,8 L372,6 Q412,4 416,44 L418,512 Q420,552 380,556 L40,558 Q0,560 4,520 Z"
            />
          </svg>

          <div className="relative z-0">
             <img
              src={profile.avatar}
              alt={profile.name}
              className="w-full aspect-[3/4] object-cover rounded-[48px_48px_48px_12px] shadow-2xl filter saturate-[0.85] hover:saturate-100 transition-[filter] duration-1000"
              referrerPolicy="no-referrer"
            />
            
            {/* Polaroid Badge */}
            <div className="absolute -bottom-6 left-0 right-0 bg-brand-white border border-brand-mist rounded-b-xl shadow-lg p-5 flex items-center justify-between z-20">
              <span className="font-signature text-3xl text-brand-ink/70 leading-none">{firstName}</span>
              <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[0.25em] text-brand-terracotta">
                <div className="w-1 h-1 rounded-full bg-current" />
                {profile.city} • {profile.neighborhood}
              </div>
            </div>

            {/* Shield Badge */}
            <div className="absolute top-8 right-8 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg border border-brand-mist/50 z-20">
               <ShieldCheck size={24} className="text-brand-terracotta" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
