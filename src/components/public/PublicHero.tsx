import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ShieldCheck, Zap, Instagram, ChevronRight, MapPin, Home, Users, Star, X, CheckCircle2, Clock, Copy, Car } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { getLocalDateStr, parseLocalDate } from '../../lib/bookingUtils';
import PremiumButton from '../PremiumButton';
import { UserProfile, Service } from '../../types';
import { getProfileHeroCopy } from '../../lib/copy';

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
  const [showLocationModal, setShowLocationModal] = useState(false);
  const firstName = profile.name.split(' ')[0];
  const lastName = profile.name.split(' ').slice(1).join(' ');
  const tagline = getProfileHeroCopy(profile.professionalIdentity?.mainSpecialty || profile.specialty);

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
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-brand-terracotta">
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-[0.4em]">Profissional Verificada Nera</span>
            </div>
            
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-stone/60">
              {tagline.main} <span className="font-serif italic lowercase">{tagline.accent}</span>
            </p>
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

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-brand-stone/60">
                <MapPin size={14} className="text-brand-terracotta shrink-0" />
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-ink">
                    {profile.serviceMode === 'home' ? (
                      `Atendimento em Domicílio • ${profile.city}`
                    ) : (
                      <>
                        {profile.studioAddress?.privacyMode === 'public_full' ? (
                          <>Estúdio em {profile.studioAddress.street}, {profile.studioAddress.number}</>
                        ) : (
                          <>Estúdio em {profile.studioAddress?.neighborhood || profile.neighborhood || profile.city}</>
                        )}
                        {profile.serviceMode === 'hybrid' && ' • Domicílio'}
                      </>
                    )}
                  </span>
                  {(profile.serviceMode === 'studio' || profile.serviceMode === 'hybrid') && (
                    <span className="text-[9px] font-medium text-brand-stone/80 uppercase tracking-widest pl-0">
                      {profile.studioAddress?.privacyMode === 'public_full' ? (
                        <>{profile.studioAddress.neighborhood}, {profile.studioAddress.city}</>
                      ) : (
                        profile.studioAddress?.reference && (
                          <>Próximo {profile.studioAddress.reference.toLowerCase().startsWith('à') || profile.studioAddress.reference.toLowerCase().startsWith('a ') ? '' : 'à '}{profile.studioAddress.reference}</>
                        )
                      )}
                    </span>
                  )}
                  {profile.serviceMode !== 'studio' && (
                    <span className="text-[9px] font-medium text-brand-stone/60 uppercase tracking-widest">
                      {profile.serviceAreaType === 'city_wide' ? (
                        'Atende em toda a cidade'
                      ) : profile.serviceAreas && profile.serviceAreas.length > 0 ? (
                        `Atende em: ${profile.serviceAreas.slice(0, 2).map(a => a.name).join(', ')}${profile.serviceAreas.length > 2 ? ` e +${profile.serviceAreas.length - 2} bairros` : ''}`
                      ) : null}
                    </span>
                  )}
                </div>
              </div>
              
              {(profile.serviceMode === 'studio' || profile.serviceMode === 'hybrid') && (
                <button 
                  onClick={() => setShowLocationModal(true)}
                  className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-brand-terracotta hover:text-brand-sienna transition-colors group w-fit"
                >
                  <div className="w-5 h-5 rounded-full border border-brand-terracotta/20 flex items-center justify-center group-hover:bg-brand-terracotta group-hover:text-brand-white transition-all">
                    <MapPin size={10} />
                  </div>
                  <span className="border-b border-brand-terracotta/20 group-hover:border-brand-terracotta transition-all">
                    {profile.studioAddress?.privacyMode === 'public_full' ? 'Como chegar' : 'Ver localização'}
                  </span>
                </button>
              )}
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

          {nextSlot ? (
            <div className="flex flex-col gap-2">
              <div className="inline-flex items-center gap-3 bg-brand-white border border-brand-mist px-5 py-3 rounded-full shadow-sm opacity-0 pointer-events-none hidden">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta animate-pulse" />
                <span className="text-[9px] font-bold uppercase tracking-[0.18em]">
                  Próximo horário: <span className="text-brand-terracotta">
                    {(() => {
                      const today = getLocalDateStr();
                      const tomorrowDate = new Date();
                      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
                      const tomorrow = getLocalDateStr(tomorrowDate);
                      
                      if (nextSlot.date === today) return `hoje às ${nextSlot.time}`;
                      if (nextSlot.date === tomorrow) return `amanhã às ${nextSlot.time}`;
                      
                      // Format for date if further than tomorrow
                      const dateObj = parseLocalDate(nextSlot.date);
                      const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0];
                      const day = dateObj.getDate();
                      return `${weekDay}, dia ${day} às ${nextSlot.time}`;
                    })()}
                  </span>
                </span>
              </div>
              
              {/* Texto Seguro Temporário */}
              <div className="inline-flex items-center gap-3 bg-brand-linen/40 border border-brand-mist px-5 py-3 rounded-full shadow-sm">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-stone">
                  Consulte os próximos horários
                </span>
              </div>
            </div>
          ) : isAgendaFull ? (
            <div className="inline-flex items-center gap-3 bg-brand-linen border border-brand-terracotta/20 px-5 py-3 rounded-full shadow-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta/40" />
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-stone">
                Alta procura no momento • <span className="text-brand-terracotta">Novos horários em breve</span>
              </span>
            </div>
          ) : null}

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
      <AnimatePresence>
        {showLocationModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setShowLocationModal(false)}
              className="absolute inset-0 bg-brand-ink/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-brand-white rounded-[40px] p-10 shadow-2xl overflow-hidden border border-brand-mist"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-linen/50 rounded-full -mr-16 -mt-16 blur-2xl" />
              
              <button 
                onClick={() => setShowLocationModal(false)}
                className="absolute top-8 right-8 p-1 text-brand-stone hover:text-brand-ink transition-colors z-10"
              >
                <X size={20} />
              </button>

              <div className="relative z-10 space-y-8 text-center">
                <div className="w-16 h-16 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mx-auto shadow-sm border border-brand-mist">
                  <MapPin size={32} />
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-serif text-2xl text-brand-ink">Nosso Espaço</h3>
                  <p className="text-brand-stone font-light text-sm italic">Endereço do estúdio</p>
                </div>

                <div className="space-y-6 bg-brand-parchment/50 p-7 rounded-[32px] border border-brand-mist/50">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-terracotta">Endereço</p>
                      <p className="text-sm font-medium text-brand-ink leading-relaxed">
                        {profile.studioAddress ? (
                          <>
                            {profile.studioAddress.street}, {profile.studioAddress.number}
                            {profile.studioAddress.complement && <span className="block">{profile.studioAddress.complement}</span>}
                            <span className="block opacity-60">{profile.studioAddress.neighborhood}, {profile.studioAddress.city}</span>
                          </>
                        ) : (
                          <>
                            {profile.neighborhood || profile.city}
                            <span className="block opacity-60 text-[10px]">Endereço detalhado em atualização</span>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          if (profile.studioAddress) {
                            const addr = `${profile.studioAddress.street}, ${profile.studioAddress.number}, ${profile.studioAddress.neighborhood}, ${profile.studioAddress.city}`;
                            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank');
                          }
                        }}
                        disabled={!profile.studioAddress}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-white border border-brand-mist rounded-xl text-[10px] font-bold uppercase tracking-widest text-brand-ink hover:border-brand-ink transition-all shadow-sm disabled:opacity-50"
                      >
                        <MapPin size={14} className="text-brand-terracotta" /> Abrir no Google Maps
                      </button>
                      
                      <button 
                        onClick={() => {
                          if (profile.studioAddress) {
                            const addr = `${profile.studioAddress.street}, ${profile.studioAddress.number} - ${profile.studioAddress.neighborhood}, ${profile.studioAddress.city}`;
                            navigator.clipboard.writeText(addr);
                            toast.success('Endereço copiado!');
                          }
                        }}
                        disabled={!profile.studioAddress}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-linen/50 border border-brand-mist/30 rounded-xl text-[10px] font-bold uppercase tracking-widest text-brand-ink hover:border-brand-ink transition-all disabled:opacity-50"
                      >
                        <Copy size={14} className="text-brand-stone" /> Copiar endereço
                      </button>
                    </div>
                  </div>

                  {/* Conditional Badges */}
                  {(profile.studioAddress?.hasParking || profile.studioAddress?.hasAccessibility || profile.studioAddress?.isSafeLocation) && (
                    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 pt-2 border-t border-brand-mist/30">
                      {profile.studioAddress?.hasParking && (
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1.5 text-brand-ink">
                            <Car size={12} className="text-brand-terracotta" />
                            <span className="text-[9px] font-bold uppercase tracking-widest">Estacionamento</span>
                          </div>
                          {profile.studioAddress.parkingInfo && (
                            <span className="text-[8px] text-brand-stone/60 uppercase">{profile.studioAddress.parkingInfo}</span>
                          )}
                        </div>
                      )}

                      {profile.studioAddress?.hasAccessibility && (
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1.5 text-brand-ink">
                            <CheckCircle2 size={12} className="text-brand-terracotta" />
                            <span className="text-[9px] font-bold uppercase tracking-widest">Acessível</span>
                          </div>
                        </div>
                      )}

                      {profile.studioAddress?.isSafeLocation && (
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1.5 text-brand-ink">
                            <ShieldCheck size={12} className="text-brand-terracotta" />
                            <span className="text-[9px] font-bold uppercase tracking-widest">Local seguro</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <PremiumButton 
                  onClick={() => { setShowLocationModal(false); onBookingClick(); }}
                  variant="terracotta" 
                  className="w-full py-5 text-[10px]"
                >
                  Continuar para reserva
                </PremiumButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};
