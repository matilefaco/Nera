import React, { useEffect, useRef } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import './LandingPage.css';
import PricingGrid from '../components/PricingGrid';
import { ShowcaseSequence } from '../components/ShowcaseSequence';
import { landingVariants } from '../constants/landingVariants';

export default function LandingPageVariant() {
  const { nichePath } = useParams<{ nichePath: string }>();
  const navRef = useRef<HTMLElement>(null);

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
            <div className="professions reveal">
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
            </div>
          </div>
        </div>
      </section>

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
              <Link to="/para-sobrancelhistas" className="footer-link">Sobrancelhistas</Link>
              <Link to="/para-esteticistas" className="footer-link">Esteticistas</Link>
              <Link to="/para-cabeleireiras" className="footer-link">Cabeleireiras</Link>
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
