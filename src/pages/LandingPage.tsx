import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';
import PricingGrid from '../components/PricingGrid';

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
      <section id="hero" style={{ paddingLeft: '48px', paddingRight: '48px', maxWidth: 'none' }}>
        <div className="wrap" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div className="hero-bg-glyph">n</div>
          <div className="hero-inner">

            <div className="hero-tag fade-in">
              <div className="hero-tag-dot"></div>
              <span>Para profissionais autônomas de beleza</span>
            </div>

            <h1 className="hero-h1 fade-in d1">
              Você responde<br/>
              o dia inteiro.<br/>
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
              <Link to="/p/helena-prado" className="btn-ghost">
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

      {/* HOW IT WORKS */}
      <section id="how">
        <div className="wrap">
          <span className="label section-eyebrow-terra reveal">Como funciona</span>
          <h2 className="how-h2 reveal">
            Três passos.<br/>
            <em>Uma nova realidade.</em>
          </h2>
          <div className="steps">
            <div className="step reveal">
              <div className="step-num">1</div>
              <div className="step-body">
                <h3 className="step-title"><em>Crie seu perfil</em> em minutos</h3>
                <p className="step-desc">Fotos, serviços, preços e disponibilidade. Sua vitrine pública fica pronta para receber clientes antes de você terminar o café.</p>
              </div>
            </div>
            <div className="step reveal rd1">
              <div className="step-num">2</div>
              <div className="step-body">
                <h3 className="step-title">Clientes agendam <em>sozinhos</em></h3>
                <p className="step-desc">Compartilhe seu link e pronto. Confirmação automática por WhatsApp para você e para a cliente — sem nenhum esforço da sua parte.</p>
              </div>
            </div>
            <div className="step reveal rd2">
              <div className="step-num">3</div>
              <div className="step-body">
                <h3 className="step-title">Você só <em>atende e cresce</em></h3>
                <p className="step-desc">Acompanhe resultados, fidelize clientes e tome decisões com dados reais. A nera cuida da operação. Você cuida da arte.</p>
              </div>
            </div>
          </div>
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
            <h3 className="feat-title">Confirmação automática</h3>
            <p className="feat-desc">Lembrete 24h antes via WhatsApp com sua identidade. Falta virou exceção — não regra.</p>
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

      {/* TESTIMONIALS */}
      <section id="testimonials">
        <div className="wrap">
          <span className="label test-eyebrow reveal">O que dizem as profissionais</span>
          <h2 className="test-h2 reveal">
            Reputação que<br/>
            <em>converte.</em>
          </h2>
          <div className="testimonials-grid reveal">
            <div className="test-card dark">
              <div className="stars">
                <span className="star">★</span><span className="star">★</span><span className="star">★</span><span className="star">★</span><span className="star">★</span>
              </div>
              <p className="test-quote">"Minha página ficou com cara de marca grande. Minhas clientes amaram a facilidade de agendar sozinhas — e eu parei de perder tempo no WhatsApp."</p>
              <div className="test-author-block">
                <div className="test-avatar">K</div>
                <div className="test-author-info">
                  <div className="test-author-name">Karina M.</div>
                  <div className="test-author-role">Nail Designer · São Paulo</div>
                </div>
              </div>
            </div>
            <div className="test-card light">
              <div className="stars">
                <span className="star">★</span><span className="star">★</span><span className="star">★</span><span className="star">★</span><span className="star">★</span>
              </div>
              <p className="test-quote">"A nera me deu uma coisa que dinheiro não compra: tempo de qualidade com minha família. Meu negócio roda mesmo quando desligo o celular."</p>
              <div className="test-author-block">
                <div className="test-avatar">J</div>
                <div className="test-author-info">
                  <div className="test-author-name">Juliana F.</div>
                  <div className="test-author-role">Esteticista · Belo Horizonte</div>
                </div>
              </div>
            </div>
            <div className="test-card dark" style={{ gridColumn: '1 / -1' }}>
              <div className="stars">
                <span className="star">★</span><span className="star">★</span><span className="star">★</span><span className="star">★</span><span className="star">★</span>
              </div>
              <p className="test-quote" style={{ maxWidth: '680px' }}>"Parece que alguém está cuidando da minha agenda enquanto eu atendo. As clientes recebem as informações certas, os horários ficam claros e eu não termino o dia tentando lembrar o que esqueci."</p>
              <div className="test-author-block">
                <div className="test-avatar">B</div>
                <div className="test-author-info">
                  <div className="test-author-name">Bianca Rocha</div>
                  <div className="test-author-role">Esteticista · Rio de Janeiro</div>
                </div>
              </div>
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
