import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, createBookingRequest } from '../firebase';
import { collection, query, where, getDocs, addDoc, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Phone, Calendar as CalendarIcon, Clock, 
  CheckCircle2, ChevronRight, ArrowLeft, Sparkles,
  ShieldCheck, Instagram, Heart, Info, MessageCircle,
  ExternalLink, ArrowDown, Star, Share2, Copy,
  Check, Award, Users, Zap, HelpCircle, Home, Plus, X
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { toast } from 'sonner';
import Logo from '../components/Logo';

// --- Sub-components for the Premium Slug Page ---

const SectionHeading = ({ label, title, subtitle, centered = true }: any) => (
  <div className={cn("mb-16", centered ? "text-center" : "text-left")}>
    <span className="label-text mb-4 block">{label}</span>
    <h2 className="heading-section text-brand-ink mb-4">{title}</h2>
    {subtitle && <p className="body-text text-brand-stone max-w-lg mx-auto italic">{subtitle}</p>}
  </div>
);

const PremiumButton = ({ children, onClick, variant = 'primary', className, disabled, loading }: any) => {
  const baseStyles = "relative overflow-hidden px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-[0.2em] transition-all duration-500 flex items-center justify-center gap-3";
  const variants: any = {
    primary: "bg-brand-ink text-brand-white hover:bg-brand-espresso premium-shadow",
    secondary: "bg-brand-white text-brand-ink border border-brand-mist hover:border-brand-ink",
    terracotta: "bg-brand-terracotta text-brand-white hover:bg-brand-sienna premium-shadow",
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled || loading}
      className={cn(baseStyles, variants[variant], className, (disabled || loading) && "opacity-50 cursor-not-allowed")}
    >
      {loading ? (
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          <Sparkles size={18} />
        </motion.div>
      ) : children}
    </button>
  );
};

export default function PublicProfile() {
  const { slug } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const servicesRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  
  // Booking Flow State
  const [step, setStep] = useState(1);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedArea, setSelectedArea] = useState<any>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [blockedSlots, setBlockedSlots] = useState<string[]>([]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }

      // Fallback for Demo/Example
      if (slug === 'helena-prado') {
        const demoProfile = {
          uid: 'demo-uid',
          name: 'Helena Prado',
          specialty: 'Design de Sobrancelhas e Brow Lamination',
          city: 'Fortaleza',
          bio: 'Atendimento em domicílio com experiência premium, foco em naturalidade e acabamento elegante.',
          avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop',
          avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=800&auto=format&fit=crop',
          instagram: 'helenaprado.beauty',
          whatsapp: '5585999999999',
          serviceMode: 'home',
          serviceAreas: [
            { name: 'Aldeota', fee: 15 },
            { name: 'Meireles', fee: 15 },
            { name: 'Cocó', fee: 20 },
            { name: 'Dionísio Torres', fee: 20 }
          ],
          portfolio: [
            { url: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?q=80&w=1200&auto=format&fit=crop', category: 'Design Perfeito' },
            { url: 'https://images.unsplash.com/photo-1620331311520-246422fd82f9?q=80&w=1200&auto=format&fit=crop', category: 'Brow Lamination' },
            { url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?q=80&w=1200&auto=format&fit=crop', category: 'Close Técnico' },
            { url: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?q=80&w=1200&auto=format&fit=crop', category: 'Processo' },
            { url: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?q=80&w=1200&auto=format&fit=crop', category: 'Resultado Final' },
            { url: 'https://images.unsplash.com/photo-1600948836101-f9ffda59d250?q=80&w=1200&auto=format&fit=crop', category: 'Macro dos Fios' }
          ]
        };
        const demoServices = [
          { id: 's1', name: 'Design de Sobrancelhas', duration: 50, price: 80, description: 'Mapeamento facial completo e design personalizado.' },
          { id: 's2', name: 'Brow Lamination', duration: 80, price: 140, description: 'Alinhamento dos fios para um olhar mais marcante e volumoso.' },
          { id: 's3', name: 'Henna + Design', duration: 70, price: 95, description: 'Preenchimento natural com henna de alta durabilidade.' }
        ];
        const demoReviews = [
          { id: 'r1', firstName: 'Mariana', neighborhood: 'Aldeota', rating: 5, comment: 'A Helena é impecável. O atendimento em domicílio é super prático e ela traz um clima de spa para casa.', serviceName: 'Design Premium', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString() },
          { id: 'r2', firstName: 'Beatriz', neighborhood: 'Meireles', rating: 5, comment: 'Melhor brow lamination que já fiz! Super natural e duradouro. Recomendo de olhos fechados.', serviceName: 'Brow Lamination', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString() },
          { id: 'r3', firstName: 'Carla', neighborhood: 'Cocó', rating: 5, comment: 'Profissional extremamente pontual e organizada. O material é todo esterilizado, me senti muito segura.', serviceName: 'Design + Henna', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() }
        ];
        const demoStats = {
          averageRating: 4.9,
          totalReviews: 84,
          totalCompletedBookings: 320,
          topTags: ['Pontualidade', 'Delicadeza', 'Organização', 'Resultado natural']
        };
        setProfile(demoProfile);
        setServices(demoServices);
        setReviews(demoReviews);
        setStats(demoStats);
        setLoading(false);
        return;
      }

      try {
        const q = query(collection(db, 'users'), where('slug', '==', slug));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
          const professionalId = snapshot.docs[0].id;
          setProfile({ ...userData, uid: professionalId });
          
          // Fetch Services
          const servicesQ = query(collection(db, 'services'), 
            where('professionalId', '==', professionalId), 
            where('active', '==', true)
          );
          const servicesSnapshot = await getDocs(servicesQ);
          setServices(servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

          // Fetch Stats
          const statsDoc = await getDocs(query(collection(db, 'review_stats'), where('professionalId', '==', professionalId)));
          if (!statsDoc.empty) {
            setStats(statsDoc.docs[0].data());
          }

          // Fetch Reviews
          const reviewsQ = query(
            collection(db, 'reviews'), 
            where('professionalId', '==', professionalId),
            where('publicApproved', '==', true),
            where('publicDisplayMode', 'in', ['named', 'anonymous'])
          );
          const reviewsSnapshot = await getDocs(reviewsQ);
          setReviews(reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

          // Fetch Portfolio
          // The new structure stores portfolio as an array in the user document.
          // We already have userData.portfolio from the first fetch.
          // If it's missing or we want to support legacy sub-collection:
          if (!userData.portfolio || userData.portfolio.length === 0) {
            try {
              const portfolioQ = query(collection(db, 'users', professionalId, 'portfolio'), orderBy('createdAt', 'desc'));
              const portfolioSnapshot = await getDocs(portfolioQ);
              if (!portfolioSnapshot.empty) {
                const portfolioItems = portfolioSnapshot.docs.map(doc => ({
                  url: doc.data().imageUrl,
                  category: doc.data().category
                }));
                setProfile(prev => prev ? { ...prev, portfolio: portfolioItems } : null);
              }
            } catch (portErr) {
              console.warn('[PublicProfile] Error fetching legacy portfolio sub-collection:', portErr);
            }
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Error fetching public profile:", error);
        toast.error("Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [slug]);

  useEffect(() => {
    if (selectedDate && profile?.uid) {
      const fetchBlockedSlots = async () => {
        const slotsRef = collection(db, 'blocked_slots');
        const q = query(
          slotsRef, 
          where('professionalId', '==', profile.uid),
          where('date', '==', selectedDate)
        );
        const snapshot = await getDocs(q);
        setBlockedSlots(snapshot.docs.map(doc => doc.data().time));
      };
      fetchBlockedSlots();
    }
  }, [selectedDate, profile?.uid]);

  const calculateTotalPrice = () => {
    if (!selectedService) return 0;
    const basePrice = Number(selectedService.price) || 0;
    return basePrice + (selectedArea?.fee || 0);
  };

  const handleBooking = async () => {
    if (!profile || !selectedService) return;
    setBookingLoading(true);
    try {
      const totalPrice = calculateTotalPrice();
      await createBookingRequest({
        professionalId: profile.uid,
        professionalName: profile.name,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        price: selectedService.price,
        travelFee: selectedArea?.fee || 0,
        totalPrice: totalPrice,
        locationType: isHomeService ? 'home' : 'studio',
        neighborhood: selectedArea?.name || '',
        address: clientAddress,
        clientName,
        clientWhatsapp: clientPhone,
        clientEmail,
        date: selectedDate,
        time: selectedTime,
      });
      setStep(5); // Success
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error("Booking error:", error);
      toast.error('Erro ao agendar horário');
    } finally {
      setBookingLoading(false);
    }
  };

  const scrollToServices = () => {
    servicesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-parchment">
      <motion.div 
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} 
        transition={{ repeat: Infinity, duration: 2 }} 
        className="text-brand-terracotta"
      >
        <Logo variant="light" className="w-24 opacity-20" />
      </motion.div>
    </div>
  );
  
  if (!profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-parchment p-6 text-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-24 h-24 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-10 border border-brand-mist shadow-sm"
      >
        <Info size={40} strokeWidth={1.5} />
      </motion.div>
      <h1 className="text-4xl font-serif font-normal text-brand-ink mb-6">Página não encontrada</h1>
      <p className="body-text text-brand-stone mb-12 max-w-sm mx-auto leading-relaxed">
        O link que você acessou pode estar incorreto ou o perfil da profissional ainda não foi publicado.
      </p>
      
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link 
          to="/" 
          className="w-full sm:w-auto bg-brand-ink text-brand-white px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-espresso transition-all premium-shadow"
        >
          Voltar para o início
        </Link>
        <Link 
          to="/p/helena-prado" 
          className="w-full sm:w-auto bg-brand-white text-brand-ink border border-brand-mist px-10 py-5 rounded-full text-[11px] font-medium uppercase tracking-widest hover:bg-brand-linen transition-all"
        >
          Ver perfil de exemplo
        </Link>
      </div>
    </div>
  );

  const isHomeService = profile.serviceMode === 'home' || profile.serviceMode === 'hybrid';

  return (
    <div className="min-h-screen bg-brand-parchment flex flex-col selection:bg-brand-terracotta/10">
      
      {/* Sticky Header for Mobile Conversion */}
      <AnimatePresence>
        {scrolled && step === 1 && (
          <motion.div 
            initial={{ y: -100 }} 
            animate={{ y: 0 }} 
            exit={{ y: -100 }}
            className="fixed top-0 left-0 w-full bg-brand-white/80 backdrop-blur-md border-b border-brand-mist z-[100] px-6 py-4 flex items-center justify-between md:hidden"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-brand-mist">
                <img src={profile.avatar || profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <span className="font-serif text-brand-ink text-sm">{profile.name.split(' ')[0]}</span>
            </div>
            <button 
              onClick={scrollToServices}
              className="bg-brand-ink text-brand-white px-6 py-3 rounded-full text-[9px] font-medium uppercase tracking-widest"
            >
              Agendar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. HERO PREMIUM */}
      <header className="relative min-h-[90vh] flex flex-col items-center justify-center pt-32 pb-24 px-6 text-center overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-brand-linen/40 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-brand-blush/30 rounded-full blur-[80px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 max-w-3xl mx-auto"
        >
          {/* Avatar with refined border */}
          <div className="relative w-40 h-40 md:w-48 md:h-48 mx-auto mb-12">
            <div className="absolute inset-0 bg-brand-terracotta/10 rounded-full animate-pulse" />
            <div className="relative w-full h-full rounded-full overflow-hidden border-[6px] border-brand-white shadow-2xl">
              {(profile.avatar || profile.avatarUrl) ? (
                <img src={profile.avatar || profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full bg-brand-linen flex items-center justify-center text-brand-terracotta text-6xl font-serif">
                  {profile.name?.[0]}
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 w-12 h-12 bg-brand-white rounded-full flex items-center justify-center shadow-lg border border-brand-mist">
              <ShieldCheck size={24} className="text-brand-terracotta" />
            </div>
          </div>

          <span className="label-text mb-6 block text-brand-terracotta">Profissional Verificada</span>
          <h1 className="display-hero text-brand-ink mb-6">{profile.name}</h1>
          
          <div className="flex flex-col items-center gap-4 mb-10">
            <p className="text-[12px] md:text-[14px] font-medium text-brand-stone uppercase tracking-[0.4em]">{profile.specialty || 'Especialista em Beleza'}</p>
            <div className="h-px w-12 bg-brand-mist" />
            <p className="body-text text-brand-stone max-w-md italic text-lg">
              "{profile.bio || 'Transformando olhares e elevando a autoestima com atendimento personalizado e exclusivo.'}"
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-8 mb-16 text-[11px] font-medium uppercase tracking-widest text-brand-stone">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-brand-terracotta" />
              <span className="editorial-underline">{profile.city}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-brand-terracotta" />
              <span>Confirmação Instantânea</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <PremiumButton onClick={scrollToServices} className="w-full sm:w-auto min-w-[280px]">
              Reservar Experiência <ChevronRight size={18} />
            </PremiumButton>
            {profile.instagram && (
              <a 
                href={`https://instagram.com/${profile.instagram.replace('@', '')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-widest text-brand-stone hover:text-brand-ink transition-colors group"
              >
                <Instagram size={18} className="group-hover:text-brand-terracotta transition-colors" />
                <span>Ver Portfólio</span>
              </a>
            )}
          </div>
        </motion.div>

        <motion.div 
          animate={{ y: [0, 10, 0] }} 
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-brand-mist"
        >
          <ArrowDown size={24} />
        </motion.div>
      </header>

      {/* 2. STATUS CARD / TRUST BAR */}
      <section className="px-6 -mt-12 relative z-20">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
          {[
            { label: 'Atendimentos', value: `${stats?.totalCompletedBookings || profile.totalBookings || '320'}+`, icon: Users },
            { label: 'Avaliação', value: `${stats?.averageRating || '4.9'}/5`, icon: Star },
            { label: 'Experiência', value: '5 anos', icon: Award },
            { label: 'Resposta', value: '< 1h', icon: Clock },
          ].map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-brand-white/80 backdrop-blur-md border border-brand-mist p-6 md:p-8 rounded-[32px] text-center premium-shadow"
            >
              <div className="w-10 h-10 bg-brand-linen rounded-2xl flex items-center justify-center text-brand-terracotta mx-auto mb-4">
                <stat.icon size={20} />
              </div>
              <div className="text-2xl font-serif text-brand-ink mb-1">{stat.value}</div>
              <div className="text-[9px] uppercase tracking-widest text-brand-stone font-medium">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 2.5 INSIGHTS AGGREGATED (Layer 3) */}
      {stats && (
        <section className="pt-24 px-6">
          <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-6">
            {stats.topTags?.map((tag: string, i: number) => (
              <div key={i} className="flex items-center gap-3 px-6 py-3 bg-brand-white border border-brand-mist rounded-full shadow-sm">
                <div className="w-2 h-2 rounded-full bg-brand-terracotta" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">{tag}</span>
              </div>
            ))}
            <div className="flex items-center gap-3 px-6 py-3 bg-brand-linen border border-brand-mist rounded-full shadow-sm">
              <Heart size={14} className="text-brand-terracotta" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">98% Recomendariam</span>
            </div>
          </div>
        </section>
      )}

      {/* 3. EDITORIAL ABOUT SECTION */}
      <section className="py-32 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="aspect-[4/5] rounded-[40px] overflow-hidden border border-brand-mist premium-shadow">
              <img 
                src={(profile.portfolio?.[0]?.url || profile.portfolio?.[0]) || (profile.avatar || profile.avatarUrl)} 
                alt="About" 
                className="w-full h-full object-cover grayscale-[20%] hover:grayscale-0 transition-all duration-1000"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-brand-linen rounded-[32px] p-8 hidden md:flex flex-col justify-end border border-brand-mist premium-shadow">
              <Sparkles size={32} className="text-brand-terracotta mb-4" />
              <p className="text-xs font-serif italic text-brand-ink">"Beleza é sobre como você se sente por dentro."</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="label-text mb-6 block">A Essência</span>
            <h2 className="heading-section text-brand-ink mb-8">A arte de desenhar olhares com naturalidade.</h2>
            <div className="space-y-6 body-text text-brand-stone text-lg">
              <p>
                Acredito que as sobrancelhas são a moldura do rosto. Meu trabalho é focado em realçar sua expressão através de um design personalizado, respeitando sua anatomia e buscando sempre a harmonia perfeita.
              </p>
              <p>
                Especialista em {profile.specialty || 'Design e Brow Lamination'}, utilizo técnicas avançadas e materiais de alta qualidade para entregar um resultado sofisticado, duradouro e, acima de tudo, natural.
              </p>
              <div className="pt-6 flex flex-wrap gap-4">
                {['Atendimento Exclusivo', 'Produtos Premium', 'Biossegurança', 'Pontualidade'].map((tag, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2 bg-brand-white border border-brand-mist rounded-full text-[10px] font-medium uppercase tracking-widest text-brand-stone">
                    <Check size={12} className="text-brand-terracotta" /> {tag}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 4. SERVICES SECTION */}
      <section ref={servicesRef} className="py-32 px-6 bg-brand-white border-y border-brand-mist">
        <div className="max-w-5xl mx-auto">
          <SectionHeading 
            label="Menu de Serviços" 
            title="Escolha sua Experiência" 
            subtitle="Procedimentos pensados para valorizar sua beleza de forma única e sofisticada."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {services.length > 0 ? (
              services.map((service, i) => (
                <motion.div 
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="group relative bg-brand-parchment/50 border border-brand-mist p-10 rounded-[40px] hover:bg-brand-white hover:border-brand-terracotta/20 transition-all duration-500 premium-shadow"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 mb-8">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-serif text-brand-ink group-hover:text-brand-terracotta transition-colors leading-tight">
                          {service.name}
                        </h3>
                        {i === 0 && (
                          <span className="px-3 py-1 bg-brand-terracotta/10 text-brand-terracotta text-[8px] font-bold uppercase tracking-widest rounded-full shrink-0">
                            Mais Desejado
                          </span>
                        )}
                      </div>
                      <p className="body-text text-brand-stone text-sm leading-relaxed max-w-md">
                        {service.description || 'Um atendimento completo focado em resultados impecáveis e naturais.'}
                      </p>
                    </div>
                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2">
                      <div className="text-2xl font-serif text-brand-terracotta whitespace-nowrap">
                        {formatCurrency(service.price)}
                      </div>
                      <div className="text-[9px] uppercase tracking-widest text-brand-stone font-medium flex items-center gap-1.5 bg-brand-linen/50 px-3 py-1.5 rounded-full sm:bg-transparent sm:p-0">
                        <Clock size={10} className="text-brand-terracotta" /> {service.duration} min
                      </div>
                    </div>
                  </div>
                  
                  <PremiumButton 
                    variant="secondary" 
                    className="w-full group-hover:bg-brand-ink group-hover:text-brand-white"
                    onClick={() => { setSelectedService(service); setStep(2); }}
                  >
                    Selecionar Data
                  </PremiumButton>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-24 text-center border-2 border-dashed border-brand-mist rounded-[40px]">
                <Sparkles size={32} className="text-brand-mist mx-auto mb-4" />
                <p className="text-brand-stone font-serif italic text-lg">Consulte a disponibilidade via WhatsApp.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. REGIONS / LOGISTICS */}
      {isHomeService && (
        <section className="py-32 px-6 bg-brand-parchment">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="label-text mb-6 block">Logística & Conforto</span>
              <h2 className="heading-section text-brand-ink mb-8">O luxo de ser atendida no conforto do seu lar.</h2>
              <p className="body-text text-brand-stone text-lg mb-10">
                Levo toda a estrutura necessária para proporcionar uma experiência de salão premium dentro da sua casa. Organização, higiene e pontualidade são meus pilares.
              </p>
              
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-ink mb-6">Regiões Atendidas em {profile.city}</h4>
                <div className="grid grid-cols-2 gap-4">
                  {profile.serviceAreas?.map((area: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-brand-white border border-brand-mist rounded-2xl">
                      <span className="text-sm font-medium text-brand-ink">{area.name}</span>
                      <span className="text-[10px] text-brand-stone italic">+{formatCurrency(area.fee)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="bg-brand-white p-12 rounded-[40px] border border-brand-mist premium-shadow relative"
            >
              <div className="absolute -top-6 -left-6 w-16 h-16 bg-brand-ink text-brand-white rounded-2xl flex items-center justify-center shadow-xl">
                <Home size={32} />
              </div>
              <h3 className="text-2xl font-serif text-brand-ink mb-8">Como funciona?</h3>
              <ul className="space-y-6">
                {[
                  { title: 'Agendamento', desc: 'Escolha seu serviço e horário aqui na página.' },
                  { title: 'Confirmação', desc: 'Receba os detalhes e orientações via WhatsApp.' },
                  { title: 'Atendimento', desc: 'Chego no horário com todo o material necessário.' },
                  { title: 'Finalização', desc: 'Pagamento facilitado após sua total satisfação.' },
                ].map((item, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-brand-linen text-brand-terracotta flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</div>
                    <div>
                      <div className="text-sm font-medium text-brand-ink mb-1">{item.title}</div>
                      <div className="text-xs text-brand-stone font-light">{item.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </section>
      )}

      {/* 6. EDITORIAL PORTFOLIO GRID */}
      {profile.portfolio && profile.portfolio.length > 0 && (
        <section className="py-32 px-6 bg-brand-white overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <SectionHeading 
              label="O Olhar em Detalhes" 
              title="Resultados com Precisão" 
              subtitle="Naturalidade, definição e acabamento elegante em cada design."
            />

            <div className="columns-1 md:columns-2 lg:columns-3 gap-8 space-y-8">
              {profile.portfolio.map((item: any, i: number) => {
                const imageUrl = typeof item === 'string' ? item : item.url;
                const category = typeof item === 'string' ? '' : item.category;
                
                return (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="relative group rounded-[32px] overflow-hidden border border-brand-mist premium-shadow break-inside-avoid"
                  >
                    <img 
                      src={imageUrl} 
                      alt={category || `Trabalho de ${profile.name}`} 
                      className="w-full object-cover transition-all duration-1000 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                    {category && (
                      <div className="absolute inset-0 bg-brand-ink/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-8">
                        <span className="text-brand-white text-[10px] font-medium uppercase tracking-widest">{category}</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 7. PROVA SOCIAL / TESTIMONIALS (Layer 2) */}
      <section className="py-32 px-6 bg-brand-linen/30">
        <div className="max-w-5xl mx-auto">
          <SectionHeading label="Experiências" title="O que elas dizem" subtitle="Avaliações reais de clientes que já vivenciaram a experiência Nera." />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {reviews.length > 0 ? (
              reviews.slice(0, 6).map((review, i) => (
                <motion.div 
                  key={review.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-brand-white p-10 rounded-[40px] border border-brand-mist premium-shadow relative"
                >
                  <div className="flex gap-1 mb-6 text-brand-terracotta">
                    {[...Array(5)].map((_, j) => (
                      <Star 
                        key={j} 
                        size={14} 
                        fill={j < review.rating ? "currentColor" : "none"} 
                        className={j < review.rating ? "" : "text-brand-mist"}
                      />
                    ))}
                  </div>
                  <p className="body-text text-brand-ink italic mb-8">"{review.comment || 'Atendimento impecável e muito profissional.'}"</p>
                  <div className="flex items-center justify-between pt-6 border-t border-brand-mist">
                    <div className="flex flex-col">
                      <span className="text-sm font-serif text-brand-ink">
                        {review.publicDisplayMode === 'anonymous' ? 'Cliente Nera' : review.firstName}
                      </span>
                      {review.neighborhood && (
                        <span className="text-[9px] text-brand-stone uppercase tracking-widest">{review.neighborhood}</span>
                      )}
                    </div>
                    <span className="text-[9px] uppercase tracking-widest text-brand-stone text-right">{review.serviceName}</span>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-24 text-center">
                <p className="text-brand-stone font-serif italic text-lg">Ainda não há avaliações públicas.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 8. DISPONIBILIDADE / CTA FINAL */}
      <section className="py-32 px-6 bg-brand-ink text-brand-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
           <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] border border-brand-white rounded-full" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-[10px] font-medium uppercase tracking-[0.4em] text-brand-terracotta mb-8 block">Agenda Aberta</span>
            <h2 className="text-[42px] md:text-[56px] font-serif font-normal mb-10 leading-tight">Pronta para sua transformação?</h2>
            <p className="text-brand-blush/60 text-lg md:text-xl mb-12 max-w-xl mx-auto font-light">
              Poucos horários disponíveis para esta semana. Garanta sua vaga e desfrute de um atendimento exclusivo.
            </p>
            
            <div className="flex flex-col items-center gap-8">
              <PremiumButton 
                variant="terracotta" 
                className="min-w-[300px] py-7 text-sm"
                onClick={scrollToServices}
              >
                Agendar Agora
              </PremiumButton>
              
              <div className="flex items-center gap-8 text-[10px] font-medium uppercase tracking-[0.2em] text-brand-blush/40">
                <div className="flex items-center gap-2"><CheckCircle2 size={14} /> 100% Seguro</div>
                <div className="flex items-center gap-2"><MessageCircle size={14} /> Suporte via WhatsApp</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 9. FAQ SECTION */}
      <section className="py-32 px-6 bg-brand-white">
        <div className="max-w-3xl mx-auto">
          <SectionHeading label="Dúvidas" title="Perguntas Frequentes" />
          
          <div className="space-y-4">
            {[
              { q: 'Como funciona o atendimento em domicílio?', a: 'Levo toda a estrutura (maca, iluminação, materiais) até você. Só preciso de um espaço pequeno e iluminado.' },
              { q: 'Quais as formas de pagamento?', a: 'Aceito PIX, Cartão de Crédito e Débito no momento do atendimento.' },
              { q: 'Posso remarcar meu horário?', a: 'Sim, com até 24h de antecedência sem custo adicional.' },
              { q: 'Quanto tempo dura o procedimento?', a: 'Varia entre 50 min a 1h30 dependendo do serviço escolhido.' },
            ].map((item, i) => (
              <details key={i} className="group bg-brand-parchment rounded-[24px] border border-brand-mist overflow-hidden transition-all">
                <summary className="flex items-center justify-between p-8 cursor-pointer list-none">
                  <span className="text-sm font-medium text-brand-ink">{item.q}</span>
                  <Plus size={18} className="text-brand-terracotta group-open:rotate-45 transition-transform" />
                </summary>
                <div className="px-8 pb-8 text-sm text-brand-stone font-light leading-relaxed">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 10. REFINED FOOTER */}
      <footer className="py-20 px-6 bg-brand-white border-t border-brand-mist text-center">
        <div className="max-w-5xl mx-auto flex flex-col items-center gap-12">
          <Logo variant="light" className="w-20 opacity-30 grayscale" />
          
          <div className="flex flex-wrap justify-center gap-10 text-[10px] font-medium uppercase tracking-widest text-brand-stone">
            <Link to="/" className="hover:text-brand-ink transition-colors">Início</Link>
            <Link to="/register" className="hover:text-brand-ink transition-colors">Seja uma Profissional</Link>
            <a href="#" className="hover:text-brand-ink transition-colors">Termos</a>
            <a href="#" className="hover:text-brand-ink transition-colors">Privacidade</a>
          </div>

          <div className="flex gap-6">
            {profile.instagram && (
              <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" className="w-10 h-10 rounded-full border border-brand-mist flex items-center justify-center text-brand-stone hover:text-brand-terracotta hover:border-brand-terracotta transition-all">
                <Instagram size={18} />
              </a>
            )}
            <a href={`https://wa.me/${profile.whatsapp}`} target="_blank" className="w-10 h-10 rounded-full border border-brand-mist flex items-center justify-center text-brand-stone hover:text-brand-terracotta hover:border-brand-terracotta transition-all">
              <MessageCircle size={18} />
            </a>
          </div>

          <p className="text-[9px] text-brand-stone/40 uppercase tracking-widest">
            © {new Date().getFullYear()} {profile.name} • Powered by Nera
          </p>
        </div>
      </footer>

      {/* --- BOOKING MODAL OVERLAY --- */}
      <AnimatePresence>
        {step > 1 && step < 5 && (
          <div className="fixed inset-0 bg-brand-ink/40 backdrop-blur-sm z-[200] flex items-end md:items-center justify-center p-0 md:p-6">
            <motion.div 
              initial={{ y: "100%" }} 
              animate={{ y: 0 }} 
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-brand-white w-full max-w-2xl rounded-t-[40px] md:rounded-[40px] p-8 md:p-12 shadow-2xl relative max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <button 
                onClick={() => setStep(1)} 
                className="absolute right-8 top-8 text-brand-stone hover:text-brand-ink transition-colors"
              >
                <X size={24} />
              </button>

              {/* Progress Indicator */}
              <div className="flex gap-2 mb-12">
                {[2, 3, 4].map((s) => (
                  <div key={s} className={cn("h-1 flex-1 rounded-full transition-all duration-500", step >= s ? "bg-brand-terracotta" : "bg-brand-mist")} />
                ))}
              </div>

              {/* Step 2: Date & Time */}
              {step === 2 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <h3 className="text-2xl font-serif text-brand-ink mb-2">Quando deseja ser atendida?</h3>
                  <p className="text-xs text-brand-stone font-light mb-10">Selecione o melhor dia e horário para você.</p>
                  
                  <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar mb-10">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(offset => {
                      const date = new Date();
                      date.setDate(date.getDate() + offset);
                      const dateStr = date.toISOString().split('T')[0];
                      const isSelected = selectedDate === dateStr;
                      return (
                        <button 
                          key={offset}
                          onClick={() => setSelectedDate(dateStr)}
                          className={cn(
                            "min-w-[70px] h-24 rounded-2xl flex flex-col items-center justify-center transition-all shrink-0",
                            isSelected ? "bg-brand-ink text-brand-white premium-shadow" : "bg-brand-parchment border border-brand-mist"
                          )}
                        >
                          <span className="text-[9px] font-medium uppercase opacity-40 mb-2">
                            {date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                          </span>
                          <span className="text-xl font-serif">{date.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDate && (
                    <div className="grid grid-cols-3 gap-3">
                      {['09:00', '10:30', '13:00', '14:30', '16:00', '17:30'].map(time => {
                        const isBlocked = blockedSlots.includes(time);
                        return (
                          <button 
                            key={time}
                            disabled={isBlocked}
                            onClick={() => { setSelectedTime(time); setStep(3); }}
                            className={cn(
                              "py-4 rounded-xl border text-sm font-medium transition-all",
                              isBlocked 
                                ? "bg-brand-mist/20 border-transparent text-brand-stone/40 cursor-not-allowed line-through" 
                                : "bg-brand-parchment border-brand-mist hover:border-brand-ink"
                            )}
                          >
                            {time}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 3: Location */}
              {step === 3 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <h3 className="text-2xl font-serif text-brand-ink mb-2">Local do Atendimento</h3>
                  <p className="text-xs text-brand-stone font-light mb-10">Onde a mágica vai acontecer?</p>
                  
                  {isHomeService ? (
                    <div className="space-y-3">
                      {profile.serviceAreas?.map((area: any) => (
                        <button 
                          key={area.name}
                          onClick={() => { setSelectedArea(area); setStep(4); }}
                          className="w-full p-6 bg-brand-parchment border border-brand-mist rounded-2xl text-left flex justify-between items-center hover:border-brand-ink transition-all"
                        >
                          <div>
                            <span className="font-medium block">{area.name}</span>
                            <span className="text-[10px] text-brand-stone italic">Taxa de deslocamento: {formatCurrency(area.fee)}</span>
                          </div>
                          <ChevronRight size={18} className="text-brand-mist" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-brand-parchment p-8 rounded-2xl border border-brand-mist text-center">
                      <MapPin size={24} className="text-brand-terracotta mx-auto mb-4" />
                      <p className="text-sm text-brand-ink font-medium mb-2">Atendimento no Estúdio</p>
                      <p className="text-xs text-brand-stone font-light mb-8">
                        {profile.serviceMode === 'home' 
                          ? `Atendimento em domicílio em ${profile.city}` 
                          : profile.studioAddress 
                            ? `${profile.studioAddress.street}, ${profile.studioAddress.number}${profile.studioAddress.complement ? ` - ${profile.studioAddress.complement}` : ''}, ${profile.studioAddress.neighborhood}, ${profile.studioAddress.city}`
                            : profile.address || profile.city}
                      </p>
                      <PremiumButton onClick={() => setStep(4)} className="w-full">Confirmar Local</PremiumButton>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Step 4: Confirmation */}
              {step === 4 && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                  <h3 className="text-2xl font-serif text-brand-ink mb-2">Quase lá...</h3>
                  <p className="text-xs text-brand-stone font-light mb-10">Confirme seus dados para finalizar o agendamento.</p>
                  
                  <div className="space-y-4 mb-10">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">Seu Nome</label>
                      <input 
                        type="text" 
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Nome completo"
                        className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">WhatsApp</label>
                      <input 
                        type="tel" 
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase tracking-widest text-brand-stone ml-1">E-mail</label>
                      <input 
                        type="email" 
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="w-full px-6 py-4 bg-brand-parchment border border-brand-mist rounded-xl outline-none focus:ring-1 focus:ring-brand-ink transition-all text-sm"
                      />
                    </div>
                  </div>

                  <div className="bg-brand-linen/50 p-8 rounded-3xl border border-brand-mist mb-10">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs text-brand-stone">Serviço</span>
                      <span className="text-xs font-medium">{selectedService.name}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs text-brand-stone">Data e Hora</span>
                      <span className="text-xs font-medium">{new Date(selectedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} às {selectedTime}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-brand-mist">
                      <span className="text-sm font-serif italic">Total</span>
                      <span className="text-xl font-serif text-brand-terracotta">{formatCurrency(calculateTotalPrice())}</span>
                    </div>
                  </div>

                  <PremiumButton 
                    onClick={handleBooking} 
                    loading={bookingLoading}
                    disabled={!clientName || !clientPhone || !clientEmail}
                    className="w-full py-6"
                  >
                    Finalizar Agendamento
                  </PremiumButton>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Step 5: Success Overlay (Full Screen) */}
      <AnimatePresence>
        {step === 5 && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="fixed inset-0 bg-brand-white z-[300] flex flex-col items-center justify-center p-8 text-center"
          >
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              transition={{ type: "spring", damping: 15 }}
              className="w-24 h-24 bg-brand-linen text-brand-terracotta rounded-full flex items-center justify-center mb-10"
            >
              <Check size={48} />
            </motion.div>
            <h2 className="text-4xl font-serif text-brand-ink mb-6">Reserva Realizada</h2>
            <p className="body-text text-brand-stone mb-12 max-w-xs mx-auto">
              Tudo pronto! Sua reserva com {profile.name} foi confirmada. Você receberá um lembrete em breve.
            </p>
            <PremiumButton onClick={() => setStep(1)} className="min-w-[250px]">
              Voltar à Vitrine
            </PremiumButton>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
