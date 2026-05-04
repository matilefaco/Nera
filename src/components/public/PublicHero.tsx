import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ShieldCheck, Instagram, ChevronRight, MapPin, Home, Users, Star, X, CheckCircle2, Clock, Copy, Car, Award, MessageCircle } from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { getLocalDateStr, parseLocalDate } from '../../lib/bookingUtils';
import PremiumButton from '../PremiumButton';
import { UserProfile, Service } from '../../types';
import { getProfileHeroCopy, getServiceModeLabel } from '../../lib/copy';

interface PublicHeroProps {
  profile: UserProfile;
  services: Service[];
  nextSlot: { date: string; time: string } | null;
  onBookingClick: (service?: Service) => void;
  heroBio?: string;
  stats?: { averageRating: number; totalCompletedBookings: number; totalReviews?: number } | null;
  isAgendaFull?: boolean;
  onWaitlistClick?: () => void;
  totalWeeklySlots?: number | null;
}

export const PublicHero = ({ 
  profile, 
  services, 
  nextSlot, 
  onBookingClick, 
  heroBio,
  stats,
  isAgendaFull,
  onWaitlistClick,
  totalWeeklySlots
}: PublicHeroProps) => {
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [showInterestPopup, setShowInterestPopup] = useState(false);
  const [interestPopupDismissed, setInterestPopupDismissed] = useState(false);
  
  const fullName = profile.name || '';
  const firstName = fullName.split(' ')[0] || 'Profissional';
  const lastName = fullName.split(' ').slice(1).join(' ');
  const initials = fullName ? fullName.split(" ").map(w => w ? w[0] : "").filter(Boolean).slice(0, 2).join("").toUpperCase() : "P";

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      
      // Dynamic logic for interest popup similar to PublicProfile
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const scrollPercent = window.scrollY / (docHeight - winHeight);
      
      if (scrollPercent > 0.8 && !showInterestPopup && !interestPopupDismissed) {
        setShowInterestPopup(true);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [showInterestPopup, interestPopupDismissed]);

  const tagline = getProfileHeroCopy(
    profile.professionalIdentity?.mainSpecialty || profile.specialty,
    profile.slug || profile.uid
  );

  const interestPopupText = (() => {
    if (totalWeeklySlots === 0) return "A agenda está fechada. Você pode entrar na lista de espera.";
    if (totalWeeklySlots !== null && totalWeeklySlots <= 5) return `Restam apenas ${totalWeeklySlots} vaga${totalWeeklySlots === 1 ? "" : "s"} esta semana.`;
    if (totalWeeklySlots !== null && totalWeeklySlots <= 10) return `A agenda de ${firstName} está quase cheia esta semana.`;
    return `A agenda da ${firstName} costuma fechar rápido esta semana.`;
  })();

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
              <div className="w-8 h-px bg-[var(--theme-primary,var(--color-brand-terracotta))]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-ink">
                {profile.headline || profile.specialty}
              </span>
            </div>

            {/* Social Proof Mini Badges */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2">
              {(() => {
                const showRating = stats && stats.averageRating > 0 && (stats.totalReviews || 0) > 0;
                const showBookings = stats && stats.totalCompletedBookings > 0;
                const showExperience = !!profile.professionalIdentity?.yearsExperience;
                
                const elements = [];
                
                if (showRating) {
                  elements.push(
                    <div key="rating" className="flex items-center gap-1.5">
                      <Star size={12} className="text-[var(--theme-primary,var(--color-brand-terracotta))] fill-[var(--theme-primary,var(--color-brand-terracotta))]" />
                      <span className="text-[10px] font-bold text-brand-ink">{stats?.averageRating}</span>
                      <span className="text-[10px] text-brand-stone uppercase tracking-widest opacity-60">Avaliação</span>
                    </div>
                  );
                }
                
                if (showBookings) {
                  elements.push(
                    <div key="bookings" className="flex items-center gap-1.5">
                      <Users size={12} className="text-[var(--theme-primary,var(--color-brand-terracotta))]" />
                      <span className="text-[10px] font-bold text-brand-ink">+{stats?.totalCompletedBookings}</span>
                      <span className="text-[10px] text-brand-stone uppercase tracking-widest opacity-60">Atendimentos</span>
                    </div>
                  );
                }
                
                if (showExperience) {
                  elements.push(
                    <div key="experience" className="flex items-center gap-1.5">
                      <Award size={12} className="text-[var(--theme-primary,var(--color-brand-terracotta))]" />
                      <span className="text-[10px] font-bold text-brand-ink">{profile.professionalIdentity?.yearsExperience} anos</span>
                      <span className="text-[10px] text-brand-stone uppercase tracking-widest opacity-60">Experiência</span>
                    </div>
                  );
                }
                
                return elements.map((el, i) => (
                  <React.Fragment key={i}>
                    {el}
                    {i < elements.length - 1 && <div className="w-px h-3 bg-brand-mist/50 my-auto hidden sm:block" />}
                  </React.Fragment>
                ));
              })()}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-brand-stone/60">
                <MapPin size={14} className="text-[var(--theme-primary,var(--color-brand-terracotta))] shrink-0" />
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-ink">
                    {profile.serviceMode === 'home' ? (
                      `${getServiceModeLabel(profile.serviceMode)} • ${profile.city}`
                    ) : (
                      <>
                        {profile.studioAddress?.privacyMode === 'public_full' ? (
                          <>Estúdio em {profile.studioAddress.street}, {profile.studioAddress.number}</>
                        ) : (
                          <>{getServiceModeLabel(profile.serviceMode)} em {profile.studioAddress?.neighborhood || profile.neighborhood || profile.city}</>
                        )}
                        {profile.serviceMode === 'hybrid' && ' (Inclui Domicílio)'}
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
                  className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-[var(--theme-primary,var(--color-brand-terracotta))] hover:opacity-80 transition-colors group w-fit"
                >
                  <div className="w-5 h-5 rounded-full border border-[var(--theme-primary,var(--color-brand-terracotta))]/20 flex items-center justify-center group-hover:bg-[var(--theme-primary,var(--color-brand-terracotta))] group-hover:text-brand-white transition-all">
                    <MapPin size={10} />
                  </div>
                  <span className="border-b border-[var(--theme-primary,var(--color-brand-terracotta))]/20 group-hover:border-[var(--theme-primary,var(--color-brand-terracotta))] transition-all">
                    {profile.studioAddress?.privacyMode === 'public_full' ? 'Como chegar' : 'Ver localização'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {nextSlot ? (
            <div className="flex flex-col gap-2">
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-3 bg-brand-white border border-brand-mist px-5 py-3 rounded-full shadow-sm w-fit"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--theme-primary,var(--color-brand-terracotta))] animate-pulse" />
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-brand-ink">
                  Próxima vaga: <span className="text-[var(--theme-primary,var(--color-brand-terracotta))]">
                    {(() => {
                      const today = getLocalDateStr();
                      const tomorrowDate = new Date();
                      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
                      const tomorrow = getLocalDateStr(tomorrowDate);
                      
                      if (nextSlot.date === today) return `hoje às ${nextSlot.time}`;
                      if (nextSlot.date === tomorrow) return `amanhã às ${nextSlot.time}`;
                      
                      const dateObj = parseLocalDate(nextSlot.date);
                      const weekDay = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0].split(',')[0];
                      const day = String(dateObj.getDate()).padStart(2, '0');
                      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                      
                      return `${weekDay}, ${day}/${month} às ${nextSlot.time}`;
                    })()}
                  </span>
                </span>
              </motion.div>
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

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-6">
              <PremiumButton
                onClick={() => isAgendaFull ? onWaitlistClick?.() : onBookingClick(services[0])}
                variant="terracotta"
                className="px-10 py-5 text-[10px] tracking-[0.22em] shadow-xl"
              >
                {isAgendaFull ? 'Entrar na lista de espera' : 'Agendar horário'}
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
            <p className="text-[9px] font-bold uppercase tracking-widest text-brand-stone opacity-40 ml-2">
              Leva menos de 30 segundos
            </p>
          </div>
        </motion.div>
      </div>

      {/* Visual Side */}
      <div className="relative flex items-center justify-center p-8 md:p-16 lg:p-24 order-1 lg:order-2 bg-brand-parchment lg:bg-transparent min-h-[70vh] lg:min-h-screen">
        <motion.div
           initial={{ opacity: 0, scale: 0.95, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
           style={scrollY > 0 && typeof window !== 'undefined' && window.innerWidth >= 1024 ? { transform: `translateY(${scrollY * 0.08}px)` } : {}}
           className="relative w-full max-w-[420px]"
        >
          {/* Organic Border SVG */}
          <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] z-10 pointer-events-none overflow-visible" viewBox="0 0 420 560" preserveAspectRatio="none">
            <path
              className="fill-none stroke-[var(--theme-primary,var(--color-brand-terracotta))]/40 stroke-[1.5] animate-draw"
              d="M12,48 Q8,12 48,8 L372,6 Q412,4 416,44 L418,512 Q420,552 380,556 L40,558 Q0,560 4,520 Z"
            />
          </svg>

          <div className="relative z-0">
             {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.name}
                className="w-full aspect-[3/4] object-cover rounded-[48px_48px_48px_12px] shadow-2xl filter saturate-[0.85] hover:saturate-100 transition-[filter] duration-1000"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full aspect-[3/4] rounded-[48px_48px_48px_12px] shadow-2xl bg-gradient-to-br from-[#A85C3A] to-[#C47A5A] flex items-center justify-center relative overflow-hidden group border border-brand-mist/20">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.1),transparent)]" />
                <span className="text-white font-serif text-6xl select-none drop-shadow-2xl relative z-10 transition-transform duration-700 group-hover:scale-110">
                  {initials}
                </span>
                <div className="absolute inset-0 border border-white/10 rounded-[48px_48px_48px_12px]" />
              </div>
            )}
            
              <div className="flex items-center justify-between p-5 flex-wrap gap-2 z-20">
                <span className="font-signature text-3xl text-brand-ink/70 leading-none">{firstName}</span>
                <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-[0.25em] text-[var(--theme-accent,var(--color-brand-terracotta))]">
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

      {/* Interest Popup */}
      <AnimatePresence>
        {showInterestPopup && (
          <div className="fixed bottom-8 left-6 right-6 md:left-auto md:right-10 md:w-96 z-[400]">
            <motion.div 
              initial={{ y: 100, opacity: 0, scale: 0.9 }} 
              animate={{ y: 0, opacity: 1, scale: 1 }} 
              exit={{ y: 100, opacity: 0, scale: 0.9 }} 
              className="bg-brand-ink text-brand-white p-8 rounded-[40px] shadow-2xl relative overflow-hidden border border-white/10"
            >
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-terracotta/20 rounded-full blur-3xl" />
              <button 
                onClick={() => { setShowInterestPopup(false); setInterestPopupDismissed(true); }} 
                className="absolute top-6 right-6 p-1 text-white/40 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta animate-pulse" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/60">
                    Horário disponível
                  </span>
                </div>
                <h3 className="text-xl font-serif mb-2 leading-tight">
                  Ainda está pensando?
                </h3>
                <p className="text-xs text-white/60 font-light mb-8 leading-relaxed">
                  {interestPopupText}
                </p>
                <div className="flex flex-col gap-3">
                  <PremiumButton 
                    variant="terracotta" 
                    className="w-full py-4 text-[10px]" 
                    onClick={() => { 
                      setShowInterestPopup(false); 
                      isAgendaFull ? onWaitlistClick?.() : onBookingClick();
                    }}
                  >
                    {isAgendaFull ? 'Entrar na lista de espera' : 'Reservar agora'}
                  </PremiumButton>
                  <a href={`https://wa.me/${profile.whatsapp?.replace(/\D/g, '')}`} target="_blank" className="flex items-center justify-center gap-2 py-4 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors">
                    <MessageCircle size={14} /> Falar no WhatsApp
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
                  <div className="space-y-4 text-center">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-terracotta">Localização</p>
                      <p className="text-sm font-medium text-brand-ink leading-relaxed">
                        {profile.studioAddress?.street ? (
                          <>
                            {profile.studioAddress.street}, {profile.studioAddress.number}
                            {profile.studioAddress.complement && <span className="block">{profile.studioAddress.complement}</span>}
                            <span className="block opacity-60">{profile.studioAddress.neighborhood}, {profile.studioAddress.city}</span>
                          </>
                        ) : (
                          <>
                            <span className="block">{profile.neighborhood || profile.city}</span>
                            <span className="block text-[11px] font-light italic text-brand-stone mt-2">Endereço detalhado disponível após a reserva</span>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      {profile.studioAddress?.street ? (
                        <>
                          <button 
                            onClick={() => {
                              const addr = `${profile.studioAddress!.street}, ${profile.studioAddress!.number}, ${profile.studioAddress!.neighborhood}, ${profile.studioAddress!.city}`;
                              window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank');
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-white border border-brand-mist rounded-xl text-[10px] font-bold uppercase tracking-widest text-brand-ink hover:border-brand-ink transition-all shadow-sm"
                          >
                            <MapPin size={14} className="text-brand-terracotta" /> Abrir no Google Maps
                          </button>
                          
                          <button 
                            onClick={() => {
                              const addr = `${profile.studioAddress!.street}, ${profile.studioAddress!.number} - ${profile.studioAddress!.neighborhood}, ${profile.studioAddress!.city}`;
                              navigator.clipboard.writeText(addr);
                              toast.success('Endereço copiado!');
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-linen/50 border border-brand-mist/30 rounded-xl text-[10px] font-bold uppercase tracking-widest text-brand-ink hover:border-brand-ink transition-all"
                          >
                            <Copy size={14} className="text-brand-stone" /> Copiar endereço
                          </button>
                        </>
                      ) : (
                        <div className="p-4 bg-brand-linen/30 border border-dotted border-brand-mist rounded-xl">
                          <p className="text-[10px] text-brand-stone font-light italic leading-snug">
                            Para sua segurança e privacidade, a profissional optou por revelar o endereço exato apenas para clientes com reserva confirmada.
                          </p>
                        </div>
                      )}
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
