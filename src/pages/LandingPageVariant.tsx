import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import './LandingPage.css';
import PricingGrid from '../components/PricingGrid';
import { ShowcaseSequence } from '../components/ShowcaseSequence';
import { landingVariants } from '../constants/landingVariants';
import { formatSpecialtyLabel } from '../lib/copy';

interface LandingPageVariantProps {
  nichePath?: string;
}

export default function LandingPageVariant({ nichePath: propNichePath }: LandingPageVariantProps = {}) {
  const { nichePath: paramNichePath } = useParams<{ nichePath: string }>();
  
  let nichePath = propNichePath || paramNichePath;
  if (nichePath && !nichePath.startsWith('para-')) {
    nichePath = `para-${nichePath}`;
  }
  
  if (!nichePath || !landingVariants[nichePath]) {
    const pathSegment = typeof window !== 'undefined' ? window.location.pathname.substring(1) : '';
    if (landingVariants[pathSegment]) {
      nichePath = pathSegment;
    }
  }

  const navRef = useRef<HTMLElement>(null);

  const [nicheProfessionals, setNicheProfessionals] = useState<any[]>([]);
  const [nicheLoading, setNicheLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchNicheProfessionals = async () => {
      try {
        const response = await fetch('/api/profile/public-directory');
        if (!response.ok) return;
        const data = await response.json();
        
        if (!active) return;
        
        // Filter by matching niche
        const filtered = data.filter((p: any) => {
          // Exclude demo/test accounts explicitly to be 100% safe
          const nameLower = (p.name || "").toLowerCase();
          const slugLower = (p.slug || "").toLowerCase();
          if (
            slugLower === "helena-prado" ||
            slugLower.includes("test") ||
            slugLower.includes("demo") ||
            nameLower.includes("teste") ||
            nameLower.includes("fake") ||
            nameLower.includes("demonstrativo")
          ) {
            return false;
          }
          
          const s = (p.specialty || "").toLowerCase().trim();
          
          if (nichePath === 'para-nail-designers') {
            return s.includes("nail") || s.includes("unha") || s.includes("manicure") || s.includes("pedicure") || s.includes("alongamento");
          }
          if (nichePath === 'para-lash-designers') {
            return s.includes("lash") || s.includes("cílios") || s.includes("cilios") || s.includes("extensão de cílios") || s.includes("extensao de cilios") || s.includes("lash lift");
          }
          if (nichePath === 'para-maquiadoras') {
            return s.includes("maquiadora") || s.includes("maquiagem") || s.includes("makeup") || s.includes("make-up") || s.includes("visagista");
          }
          if (nichePath === 'para-podologas') {
            return s.includes("podóloga") || s.includes("podologia") || s.includes("podologa");
          }
          if (nichePath === 'para-depiladoras') {
            return s.includes("depiladora") || s.includes("depilação") || s.includes("depilacao");
          }
          if (nichePath === 'para-massagistas') {
            return s.includes("massoterapeuta") || s.includes("massagem") || s.includes("massagista") || s.includes("massoterapia") || s.includes("drenagem");
          }
          if (nichePath === 'para-sobrancelhistas') {
            return s.includes("sobrancelha") || s.includes("micropigmentadora") || s.includes("micropigmentação") || s.includes("design de sobrancelhas");
          }
          if (nichePath === 'para-esteticistas') {
            return s.includes("esteticista") || s.includes("estética") || s.includes("estetica") || s.includes("limpeza de pele");
          }
          if (nichePath === 'para-cabeleireiras') {
            return s.includes("cabeleireira") || s.includes("cabelo") || s.includes("hair") || s.includes("colorista") || s.includes("terapeuta capilar");
          }
          return false;
        });
        
        // Limit to 3 profiles
        setNicheProfessionals(filtered.slice(0, 3));
      } catch (err) {
        console.error('Error fetching niche professionals:', err);
      } finally {
        if (active) {
          setNicheLoading(false);
        }
      }
    };
    
    fetchNicheProfessionals();
    return () => {
      active = false;
    };
  }, [nichePath]);

  useEffect(() => {
    const handleScroll = () => {
      if (!navRef.current) return;
      if (window.scrollY > 40) {
        navRef.current.classList.add('scrolled');
      } else {
        navRef.current.classList.remove('scrolled');
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal');
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    revealEls.forEach(el => obs.observe(el));
    
    return () => obs.disconnect();
  }, [nichePath]);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [nichePath]);

  if (!nichePath || !landingVariants[nichePath]) {
    return <Navigate to="/" replace />;
  }

  const variant = landingVariants[nichePath];

  // Helper to render appropriate lucide or vector icon for benefits
  const renderBenefitIcon = (iconType: string) => {
    switch (iconType) {
      case 'calendar':
        return (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        );
      case 'bell':
        return (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        );
      case 'shop':
        return (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
        );
      case 'chart':
        return (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        );
      case 'users':
        return (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
        );
      case 'gift':
        return (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
          </svg>
        );
      default:
        return (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  };

  return (
    <div className="landing-page">
      <Helmet>
        <title>{variant.title}</title>
        <meta name="description" content={variant.description} />
        <link rel="canonical" href={`https://usenera.com${variant.path}`} />
        <meta property="og:title" content={variant.title} />
        <meta property="og:description" content={variant.description} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://usenera.com${variant.path}`} />
        <meta property="og:site_name" content="Nera" />
        <meta property="og:locale" content="pt_BR" />
        <meta property="og:image" content="https://usenera.com/og-default.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={variant.title} />
        <meta name="twitter:description" content={variant.description} />
        <meta name="twitter:image" content="https://usenera.com/og-default.png" />
      </Helmet>

      {/* NAV */}
      <nav id="nav" ref={navRef}>
        <Link to="/" className="logo">
          <div className="logo-mark">
            <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
              <path d="M10 26V10L26 26V10" stroke="#18120E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="28" cy="28" r="3.5" fill="#A85C3A"/>
            </svg>
          </div>
          <span className="logo-text">nera</span>
        </Link>
        <div className="nav-links">
          <Link to="/login" className="nav-link">Entrar</Link>
          <Link to="/register" className="btn-nav">Começar agora</Link>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero">
        <div className="wrap">
          <div className="hero-bg-glyph">n</div>
          <div className="hero-inner">

            <div className="hero-tag fade-in">
              <div className="hero-tag-dot"></div>
              <span>Nera para {variant.niche}s</span>
            </div>

            <h1 className="hero-h1 fade-in d1">
              {variant.headline.split('|')[0]}
            </h1>

            <p className="hero-sub fade-in d2">
              {variant.subheadline}
            </p>

            <div className="hero-ctas fade-in d3">
              <Link to="/register" className="btn-primary">
                <span>Começar grátis</span>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </Link>
              <Link to="/p/helena-prado" className="btn-ghost" aria-label="Ver vitrine de exemplo">
                Ver vitrine de exemplo →
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee-strip">
        <div className="marquee-track">
          <span className="marquee-item">Agenda 24h <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Foco em {variant.niche}s <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Lembretes automáticos <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Presença digital premium <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Retorno e fidelização <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Reduz faltas <span className="marquee-sep">·</span></span>
          <span className="marquee-item">SaaS 100% Brasileiro <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Agenda 24h <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Foco em {variant.niche}s <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Lembretes automáticos <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Presença digital premium <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Retorno e fidelização <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Reduz faltas <span className="marquee-sep">·</span></span>
          <span className="marquee-item">SaaS 100% Brasileiro <span className="marquee-sep">·</span></span>
        </div>
      </div>

      {/* PROBLEM */}
      <section id="problem">
        <div className="wrap" style={{ paddingBottom: 0 }}>
          <span className="label section-eyebrow-light reveal">O desafio real</span>
          <h2 className="problem-h2 reveal">
            Chega de bagunça<br/>
            <em>no seu atendimento.</em>
          </h2>
        </div>
        <div className="problem-grid reveal">
          {variant.problems.map((prob, idx) => (
            <div className="problem-card" key={idx}>
              <div className="problem-num">{prob.num}</div>
              <p className="problem-text">{prob.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MANIFESTO */}
      <section id="manifesto">
        <div className="manifesto-inner">
          <span className="label manifesto-label reveal">— A promessa da nera</span>
          <p className="manifesto-quote reveal">
            O seu talento merece<br/>
            <em>uma gestão invisível</em><br/>
            e de alto nível.
          </p>
          <p className="manifesto-sub reveal">Criado sob medida para profissionais que valorizam a própria marca.</p>
        </div>
      </section>

      {/* SHOWCASE / EXPERIENCE */}
      <section id="showcase" className="py-24 sm:py-32 bg-[#FDFBF7]">
        <div className="wrap reveal">
          <ShowcaseSequence />
        </div>
      </section>

      {/* FEATURES */}
      <section id="features">
        <div className="wrap">
          <div className="features-header">
            <span className="label section-eyebrow-terra reveal">Benefícios</span>
            <h2 className="features-h2 reveal">
              Feito sob medida.<br/>
              <em>Pronto para usar.</em>
            </h2>
            <p className="features-intro reveal">Elimine anotações dispersas, mensagens de WhatsApp fora de hora e falta de previsibilidade. A Nera traz tranquilidade para o seu estúdio ou clínica.</p>
          </div>
        </div>
        <div className="features-grid reveal">
          {variant.benefits.map((benefit, idx) => (
            <div className="feat-card" key={idx}>
              <div className="feat-icon">
                {renderBenefitIcon(benefit.icon)}
              </div>
              <h3 className="feat-title">{benefit.title}</h3>
              <p className="feat-desc">{benefit.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOR WHO */}
      <section id="forwho">
        <div className="wrap">
          <div className="forwho-inner">
            <div>
              <span className="label section-eyebrow-light reveal">Para quem é</span>
              <h2 className="forwho-h2 reveal">
                Design inteligente<br/>
                para o seu<br/>
                sucesso <em>autônomo.</em>
              </h2>
              <p className="forwho-sub reveal">{variant.forWhoDesc}</p>
            </div>
            <div className="professions reveal grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Link to="/para-nail-designers" className={`prof-item hover:scale-105 transition-transform ${variant.niche === 'Nail Designer' ? 'font-bold' : ''}`}>
                <div className={`prof-dot ${variant.niche === 'Nail Designer' ? 'bg-brand-terracotta scale-125' : ''}`}></div>
                <span className="prof-name">Nail designer</span>
              </Link>
              <Link to="/para-cabeleireiras" className={`prof-item hover:scale-105 transition-transform ${variant.niche === 'Cabeleireira' ? 'font-bold' : ''}`}>
                <div className={`prof-dot ${variant.niche === 'Cabeleireira' ? 'bg-brand-terracotta scale-125' : ''}`}></div>
                <span className="prof-name">Cabeleireira</span>
              </Link>
              <Link to="/para-esteticistas" className={`prof-item hover:scale-105 transition-transform ${variant.niche === 'Esteticista' ? 'font-bold' : ''}`}>
                <div className={`prof-dot ${variant.niche === 'Esteticista' ? 'bg-brand-terracotta scale-125' : ''}`}></div>
                <span className="prof-name">Esteticista</span>
              </Link>
              <Link to="/para-sobrancelhistas" className={`prof-item hover:scale-105 transition-transform ${variant.niche === 'Sobrancelhista' ? 'font-bold' : ''}`}>
                <div className={`prof-dot ${variant.niche === 'Sobrancelhista' ? 'bg-brand-terracotta scale-125' : ''}`}></div>
                <span className="prof-name">Sobrancelhista</span>
              </Link>
              <Link to="/para-lash-designers" className={`prof-item hover:scale-105 transition-transform ${variant.niche === 'Lash Designer' ? 'font-bold' : ''}`}>
                <div className={`prof-dot ${variant.niche === 'Lash Designer' ? 'bg-brand-terracotta scale-125' : ''}`}></div>
                <span className="prof-name">Lash designer</span>
              </Link>
              <Link to="/para-maquiadoras" className={`prof-item hover:scale-105 transition-transform ${variant.niche === 'Maquiadora' ? 'font-bold' : ''}`}>
                <div className={`prof-dot ${variant.niche === 'Maquiadora' ? 'bg-brand-terracotta scale-125' : ''}`}></div>
                <span className="prof-name">Maquiadora</span>
              </Link>
              <Link to="/para-podologas" className={`prof-item hover:scale-105 transition-transform ${variant.niche === 'Podóloga' ? 'font-bold' : ''}`}>
                <div className={`prof-dot ${variant.niche === 'Podóloga' ? 'bg-brand-terracotta scale-125' : ''}`}></div>
                <span className="prof-name">Podóloga</span>
              </Link>
              <Link to="/para-depiladoras" className={`prof-item hover:scale-105 transition-transform ${variant.niche === 'Depiladora' ? 'font-bold' : ''}`}>
                <div className={`prof-dot ${variant.niche === 'Depiladora' ? 'bg-brand-terracotta scale-125' : ''}`}></div>
                <span className="prof-name">Depiladora</span>
              </Link>
              <Link to="/para-massagistas" className={`prof-item hover:scale-105 transition-transform ${variant.niche === 'Massagista' ? 'font-bold' : ''}`}>
                <div className={`prof-dot ${variant.niche === 'Massagista' ? 'bg-brand-terracotta scale-125' : ''}`}></div>
                <span className="prof-name">Massagista</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* LANDING TO PROFILE INTERLINKING SECTION */}
      {nicheProfessionals.length > 0 && (
        <section id="niche-professionals" className="py-24 bg-[#FAF7F2] border-t border-brand-mist/20">
          <div className="wrap">
            <div className="text-center max-w-xl mx-auto mb-16 reveal">
              <span className="label section-eyebrow-terra mb-2">Comunidade Nera</span>
              <h2 className="text-3xl font-serif text-brand-ink italic">
                Profissionais que já utilizam a Nera
              </h2>
              <p className="text-brand-stone text-xs mt-3 leading-relaxed">
                Descubra especialistas de destaque do nicho de {variant.niche} que oferecem uma experiência de agendamento premium e simplificada para suas clientes.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto reveal">
              {nicheProfessionals.map((pro) => (
                <div 
                  key={pro.slug}
                  className="bg-brand-white rounded-3xl border border-brand-mist/35 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full group"
                >
                  <div className="aspect-square relative overflow-hidden bg-brand-linen">
                    <img 
                      src={pro.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&h=400&auto=format&fit=crop'} 
                      alt={pro.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    {!!(pro.averageRating && pro.averageRating > 0) && (
                      <div className="absolute top-4 right-4 bg-brand-white/95 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/25 shadow-sm flex items-center gap-1 text-brand-terracotta">
                        <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24" className="shrink-0">
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                        </svg>
                        <span className="text-[10px] font-black">{pro.averageRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6 flex flex-col flex-grow justify-between bg-brand-white">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-brand-terracotta mb-1.5">
                        {formatSpecialtyLabel(pro.specialty)}
                      </p>
                      <h3 className="text-xl font-serif text-brand-ink italic truncate mb-2">{pro.name}</h3>
                      <div className="flex items-center gap-1 text-brand-stone text-[10px]">
                        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                        </svg>
                        <span className="truncate">
                          {pro.city}{pro.neighborhood ? ` - ${pro.neighborhood}` : ''}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <Link 
                        to={`/p/${pro.slug}`}
                        className="w-full flex items-center justify-between px-5 py-3.5 bg-brand-ink text-brand-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all group/btn"
                      >
                        <span>Conhecer Perfil</span>
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="group-hover/btn:translate-x-1 transition-transform">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VALUE PROOF */}
      <section id="proof">
        <div className="wrap">
          <span className="label proof-eyebrow reveal">Integração perfeita</span>
          <h2 className="proof-h2 reveal">
            Dê o próximo passo<br/>
            <em>sem fricção.</em>
          </h2>
          <p className="proof-intro reveal">
            Você não precisa mudar tudo de uma vez. Transicione sua agenda atual para a Nera aos poucos, organizando sua base de contatos, serviços e registros no seu ritmo.
          </p>
          <div className="proof-grid reveal">
            <div className="proof-card">
              <div className="proof-icon">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              </div>
              <h3 className="proof-title">Importe ou crie clientes</h3>
              <p className="proof-desc">Adicione suas clientes fiéis do WhatsApp em segundos e comece a registrar os atendimentos.</p>
            </div>
            <div className="proof-card">
              <div className="proof-icon">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              </div>
              <h3 className="proof-title">Sincronização flexível</h3>
              <p className="proof-desc">Insira seus horários agendados e bloqueie momentos pessoais com um toque na tela.</p>
            </div>
            <div className="proof-card">
              <div className="proof-icon">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              </div>
              <h3 className="proof-title">Crescimento sob controle</h3>
              <p className="proof-desc">Organize sua receita por serviço, visualize seus lucros reais e pare de misturar as contas.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing">
        <div className="wrap" style={{ paddingBottom: 0 }}>
          <span className="label section-eyebrow-terra reveal">Planos</span>
          <h2 className="pricing-h2 reveal">O investimento<br/><em>certo para você.</em></h2>
          <p className="pricing-sub reveal">Sem fidelidade, cancele quando desejar.</p>
        </div>
        <PricingGrid isLanding={true} />
      </section>

      {/* FAQ */}
      <section id="faq">
        <div className="wrap">
          <span className="label faq-eyebrow reveal">Perguntas frequentes</span>
          <h2 className="faq-h2 reveal">
            Pequenas respostas antes de começar.
          </h2>
          <p className="faq-intro reveal">
            Tire suas principais dúvidas sobre o funcionamento do agendamento online.
          </p>
          <div className="faq-list reveal">
            <div className="faq-item">
              <h3 className="faq-q">Preciso baixar aplicativo?</h3>
              <p className="faq-a">Não. A Nera funciona diretamente pelo navegador de qualquer celular ou computador.</p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">Minhas clientes precisam criar conta?</h3>
              <p className="faq-a">Não. Suas clientes agendam horários sem precisar de login, senha ou download.</p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">Como funcionam os lembretes do WhatsApp?</h3>
              <p className="faq-a">No plano Pro, as clientes recebem confirmações e lembretes amigáveis de forma automatizada.</p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">Posso cancelar quando quiser?</h3>
              <p className="faq-a">Sim. Sem contratos longos ou burocracia, cancele a qualquer momento com um clique.</p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">A Nera cobra taxa por agendamento?</h3>
              <p className="faq-a">Não. Todo o seu faturamento de serviços é 100% seu. Cobramos apenas o valor fixo do plano.</p>
            </div>
            <div className="faq-item">
              <h3 className="faq-q">Serve para quem trabalha sozinha?</h3>
              <p className="faq-a">Sim. Criamos a Nera focada exatamente na realidade de profissionais autônomas de beleza.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="cta">
        <div className="cta-bg-n"><span>n</span></div>
        <div className="cta-inner">
          <span className="cta-label reveal">Sua próxima cliente</span>
          <h2 className="cta-h2 reveal">
            com a cadeira<br/>
            cheia e organizada<br/>
            <em>agora mesmo.</em>
          </h2>
          <p className="cta-sub reveal">
            Menos tempo no WhatsApp respondendo as mesmas dúvidas.<br/>
            Mais tempo focado em entregar sua arte com excelência.
          </p>
          <Link to="/register" className="btn-cta-main reveal">
            <span>Começar minha agenda</span>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </Link>
          <p className="cta-fine reveal">Setup em poucos minutos · cobrança mensal simples · cancele quando quiser</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div>
            <Link to="/" className="logo">
              <div className="logo-mark" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
                  <path d="M10 26V10L26 26V10" stroke="rgba(253,250,247,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="28" cy="28" r="3.5" fill="#C47250"/>
                </svg>
              </div>
              <span className="logo-text" style={{ color: 'rgba(253,250,247,0.75)' }}>nera</span>
            </Link>
            <p className="footer-brand-desc">Plataforma de agendamento para profissionais de beleza que levam o próprio negócio a sério.</p>
          </div>
          <div>
            <div className="footer-col-title">Soluções</div>
            <div className="footer-links">
              <Link to="/para-nail-designers" className="footer-link">Nail Designers</Link>
              <Link to="/para-lash-designers" className="footer-link">Lash Designers</Link>
              <Link to="/para-sobrancelhistas" className="footer-link">Sobrancelhistas</Link>
              <Link to="/para-esteticistas" className="footer-link">Esteticistas</Link>
              <Link to="/para-cabeleireiras" className="footer-link">Cabeleireiras</Link>
              <Link to="/para-maquiadoras" className="footer-link">Maquiadoras</Link>
              <Link to="/para-podologas" className="footer-link">Podólogas</Link>
              <Link to="/para-depiladoras" className="footer-link">Depiladoras</Link>
              <Link to="/para-massagistas" className="footer-link">Massagistas</Link>
            </div>
          </div>
          <div>
            <div className="footer-col-title">Legal</div>
            <div className="footer-links">
              <Link to="/privacidade" className="footer-link">Privacidade</Link>
              <Link to="/termos" className="footer-link">Termos de uso</Link>
              <a href="mailto:suporte@usenera.com" className="footer-link">Suporte</a>
              <a href="https://instagram.com/nera.agenda" target="_blank" rel="noopener noreferrer" className="footer-link">Instagram</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span className="footer-copy">© 2026 Nera · Feita com intenção no Brasil 🇧🇷</span>
          <span className="footer-copy">Para profissionais que levam o próprio negócio a sério</span>
        </div>
      </footer>
    </div>
  );
}
