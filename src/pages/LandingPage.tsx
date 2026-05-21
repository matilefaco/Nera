import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';
import PricingGrid from '../components/PricingGrid';
import { ShowcaseSequence } from '../components/ShowcaseSequence';

export default function LandingPage() {
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
  }, []);

  return (
    <div className="landing-page">

      {/* NAV */}
      <nav id="nav" ref={navRef}>
        <a href="#" className="logo">
          <div className="logo-mark">
            <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
              <path d="M10 26V10L26 26V10" stroke="#18120E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="28" cy="28" r="3.5" fill="#A85C3A"/>
            </svg>
          </div>
          <span className="logo-text">nera</span>
        </a>
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
              <span>Para profissionais autônomas de beleza</span>
            </div>

            <h1 className="hero-h1 fade-in d1">
              Você responde{" "}
              <br className="hidden sm:inline" />
              o dia inteiro.{" "}
              <br className="hidden sm:inline" />
              <em>E ainda perde cliente.</em>
            </h1>

            <p className="hero-sub fade-in d2">
              Sua agenda inteligente que elimina o caos do WhatsApp e profissionaliza seu negócio — com reservas automáticas, lembretes e visão financeira clara.
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
          <span className="marquee-item">Menos vai-e-vem no WhatsApp <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Lembretes automáticos <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Visão financeira clara <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Para profissionais de beleza <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Anti no-show <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Feita no Brasil <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Agenda 24h <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Menos vai-e-vem no WhatsApp <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Lembretes automáticos <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Visão financeira clara <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Para profissionais de beleza <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Anti no-show <span className="marquee-sep">·</span></span>
          <span className="marquee-item">Feita no Brasil <span className="marquee-sep">·</span></span>
        </div>
      </div>

      {/* PROBLEM */}
      <section id="problem">
        <div className="wrap" style={{ paddingBottom: 0 }}>
          <span className="label section-eyebrow-light reveal">O problema real</span>
          <h2 className="problem-h2 reveal">
            Chega de caos<br/>
            <em>na sua agenda.</em>
          </h2>
        </div>
        <div className="problem-grid reveal">
          <div className="problem-card">
            <div className="problem-num">01</div>
            <p className="problem-text">Suas clientes esperam resposta antes de confirmar — e você perde tempo (e horário) a cada conversa perdida no meio do atendimento.</p>
          </div>
          <div className="problem-card">
            <div className="problem-num">02</div>
            <p className="problem-text">Clientes somem depois do primeiro atendimento. E no meio da correria, você nem percebe quem nunca mais voltou.</p>
          </div>
          <div className="problem-card">
            <div className="problem-num">03</div>
            <p className="problem-text">Você não sabe quanto perdeu em faltas este mês. Sem dado, sem controle. O dinheiro escapa sem você ver.</p>
          </div>
        </div>
      </section>

      {/* MANIFESTO */}
      <section id="manifesto">
        <div className="manifesto-inner">
          <span className="label manifesto-label reveal">— A promessa da nera</span>
          <p className="manifesto-quote reveal">
            Você não precisa de mais aplicativos.<br/>
            Você precisa de <em>um sistema que funcione</em><br/>
            enquanto você trabalha.
          </p>
          <p className="manifesto-sub reveal">Construímos a plataforma que as profissionais merecem.</p>
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
            <span className="label section-eyebrow-terra reveal">Funcionalidades</span>
            <h2 className="features-h2 reveal">
              Tudo que você precisa.<br/>
              <em>Nada que não usa.</em>
            </h2>
            <p className="features-intro reveal">Chega de agenda no papel, lembrete no WhatsApp manual e planilha no celular. A Nera centraliza tudo para que você pense só no que importa: atender bem.</p>
          </div>
        </div>
        <div className="features-grid reveal">
          <div className="feat-card">
            <div className="feat-icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </div>
            <h3 className="feat-title">Agenda inteligente</h3>
            <p className="feat-desc">Sua cliente agenda pelo seu link, 24h por dia. Sem vai-e-vem, sem erro humano. Você define os horários, a nera faz o resto.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            </div>
            <h3 className="feat-title">Lembretes profissionais</h3>
            <p className="feat-desc">Notificações por e-mail ou WhatsApp (Pro) para suas clientes não esquecerem o horário. Mais praticidade e menos faltas.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
            </div>
            <h3 className="feat-title">Vitrine digital</h3>
            <p className="feat-desc">Sua página que trabalha enquanto você atende. Bonita, rápida e personalizada — pronta para compartilhar em qualquer lugar.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <h3 className="feat-title">Relatório financeiro</h3>
            <p className="feat-desc">Saiba exatamente quanto entrou, quanto escapou em faltas e para onde crescer. Sem planilha, sem susto no fim do mês.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            </div>
            <h3 className="feat-title">Histórico de clientes</h3>
            <p className="feat-desc">Quem atendeu, quando, o quê. Fidelize com contexto — e nunca mais esqueça quem é quem.</p>
          </div>
          <div className="feat-card">
            <div className="feat-icon">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            </div>
            <h3 className="feat-title">Cupons e indicações</h3>
            <p className="feat-desc">Programe promoções e premie quem te indica. Crescimento por referência, automático e sem esforço.</p>
          </div>
        </div>
      </section>

      {/* FOR WHO */}
      <section id="forwho">
        <div className="wrap">
          <div className="forwho-inner">
            <div>
              <span className="label section-eyebrow-light reveal">Para quem é a nera</span>
              <h2 className="forwho-h2 reveal">
                Feita para quem<br/>
                leva o próprio<br/>
                negócio <em>a sério.</em>
              </h2>
              <p className="forwho-sub reveal">Profissionais autônomas de beleza que atendem em domicílio ou em estúdio próprio e querem parar de perder tempo com gestão manual.</p>
            </div>
            <div className="professions reveal">
              <div className="prof-item"><div className="prof-dot"></div><span className="prof-name">Nail designer</span></div>
              <div className="prof-item"><div className="prof-dot"></div><span className="prof-name">Cabeleireira</span></div>
              <div className="prof-item"><div className="prof-dot"></div><span className="prof-name">Esteticista</span></div>
              <div className="prof-item"><div className="prof-dot"></div><span className="prof-name">Maquiadora</span></div>
              <div className="prof-item"><div className="prof-dot"></div><span className="prof-name">Podóloga</span></div>
              <div className="prof-item"><div className="prof-dot"></div><span className="prof-name">Depiladora</span></div>
              <div className="prof-item"><div className="prof-dot"></div><span className="prof-name">Sobrancelhista</span></div>
              <div className="prof-item"><div className="prof-dot"></div><span className="prof-name">Massagista</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* VALUE PROOF */}
      <section id="proof">
        <div className="wrap">
          <span className="label proof-eyebrow reveal">Presença que explica valor</span>
          <h2 className="proof-h2 reveal">
            O que sua cliente entende<br/>
            <em>antes de te chamar.</em>
          </h2>
          <p className="proof-intro reveal">
            Sua vitrine não é só bonita. Ela organiza a primeira impressão: mostra seu trabalho, explica seus serviços e transforma interesse em agendamento.
          </p>
          <div className="proof-grid reveal">
            <div className="proof-card">
              <div className="proof-icon">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              </div>
              <h3 className="proof-title">Ela vê seu trabalho</h3>
              <p className="proof-desc">Portfólio, especialidade e identidade visual em um link com cara de marca.</p>
            </div>
            <div className="proof-card">
              <div className="proof-icon">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              </div>
              <h3 className="proof-title">Ela entende como agendar</h3>
              <p className="proof-desc">Serviços, horários e informações essenciais sem troca infinita de mensagens.</p>
            </div>
            <div className="proof-card">
              <div className="proof-icon">
                <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              </div>
              <h3 className="proof-title">Ela chega mais segura</h3>
              <p className="proof-desc">Tudo fica claro antes do atendimento — e você atende com menos ruído.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing">
        <div className="wrap" style={{ paddingBottom: 0 }}>
          <span className="label section-eyebrow-terra reveal">Planos</span>
          <h2 className="pricing-h2 reveal">O investimento<br/><em>certo para você.</em></h2>
          <p className="pricing-sub reveal">Sem contrato de fidelidade. Cancele quando quiser.</p>
        </div>
        <PricingGrid isLanding={true} />
      </section>

      {/* FINAL CTA */}
      <section id="cta">
        <div className="cta-bg-n"><span>n</span></div>
        <div className="cta-inner">
          <span className="cta-label reveal">Sua próxima cliente</span>
          <h2 className="cta-h2 reveal">
            pode te<br/>
            encontrar<br/>
            <em>agora mesmo.</em>
          </h2>
          <p className="cta-sub reveal">
            Menos tempo no WhatsApp.<br/>
            Mais tempo fazendo o que faz você ser lembrada.
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
            <a href="#" className="logo">
              <div className="logo-mark" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <svg width="22" height="22" viewBox="0 0 36 36" fill="none">
                  <path d="M10 26V10L26 26V10" stroke="rgba(253,250,247,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="28" cy="28" r="3.5" fill="#C47250"/>
                </svg>
              </div>
              <span className="logo-text" style={{ color: 'rgba(253,250,247,0.75)' }}>nera</span>
            </a>
            <p className="footer-brand-desc">Plataforma de agendamento para profissionais de beleza que levam o próprio negócio a sério.</p>
          </div>
          <div>
            <div className="footer-col-title">Plataforma</div>
            <div className="footer-links">
              <a href="#how" className="footer-link">Como funciona</a>
              <a href="#features" className="footer-link">Funcionalidades</a>
              <a href="#pricing" className="footer-link">Planos e preços</a>
              <Link to="/profissionais" className="footer-link">Diretório</Link>
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
          <span className="footer-copy">Para profissionais que valorizam excelência</span>
        </div>
      </footer>
    </div>
  );
}
