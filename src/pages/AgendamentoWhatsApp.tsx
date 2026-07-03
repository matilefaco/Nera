import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { notify } from '../lib/notify';
import SEOHead from '../components/SEOHead';
import { ChevronDown, ArrowRight, MessageSquare, Calendar, Bell, Sparkles, Smartphone, Check } from 'lucide-react';
import './LandingPage.css';

export default function AgendamentoWhatsApp() {
  const navRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      notify.success('Seja bem-vinda à Nera.');
      navigate('/dashboard');
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error('[Google Auth Error]', error);
        notify.error('Não foi possível realizar o login com Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "A Nera agenda automaticamente pelo WhatsApp?",
      a: "A Nera fornece um link elegante para você colocar na sua bio do Instagram ou enviar no WhatsApp. Suas clientes escolhem o serviço e o horário ideal por lá, e você recebe uma notificação organizada para confirmar com um clique. No plano Pro, as notificações e lembretes amigáveis de agendamento são disparados para a cliente."
    },
    {
      q: "Minhas clientes precisam baixar algum aplicativo para agendar?",
      a: "Não. Suas clientes acessam sua vitrine digital, veem suas fotos, serviços, preços e escolhem o horário diretamente pelo navegador do celular, de forma incrivelmente rápida e sem precisar baixar nada."
    },
    {
      q: "A Nera envia lembretes amigáveis de confirmação?",
      a: "Sim. No plano Pro, as clientes recebem confirmações e lembretes automáticos sobre o agendamento, o que ajuda a reduzir as faltas de última hora em até 80%."
    },
    {
      q: "Posso continuar conversando com minhas clientes pelo WhatsApp?",
      a: "Com certeza. A Nera não substitui a relação humana ou o bate-papo com as suas clientes. Ela apenas remove a parte burocrática e repetitiva, como ficar listando horários vagos e esperando confirmações demoradas."
    },
    {
      q: "O sistema funciona bem para manicure e nail designer?",
      a: "Sim. O sistema foi desenhado sob medida para manicures, nail designers, lash designers, esteticistas, cabeleireiras e profissionais autônomas de beleza em geral."
    },
    {
      q: "A Nera possui plano gratuito para testar?",
      a: "Sim. Você pode se cadastrar e experimentar todas as funcionalidades da plataforma de forma inteiramente gratuita por um período de testes, sem compromisso e sem precisar de cartão de crédito."
    }
  ];

  return (
    <div className="landing-page">
      <SEOHead 
        title="Sistema de agendamento com WhatsApp para profissionais de beleza"
        description="Pare de responder as mesmas mensagens o dia todo. Automatize suas marcações com um link de agendamento profissional integrado com lembretes de WhatsApp."
        canonical="https://usenera.com/sistema-de-agendamento-whatsapp"
      />

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
      <section id="hero" className="relative pt-32 pb-20 overflow-hidden bg-gradient-to-b from-brand-parchment to-brand-cream">
        <div className="wrap relative z-10">
          <div className="hero-bg-glyph opacity-10">n</div>
          <div className="hero-inner max-w-4xl mx-auto text-center">
            <div className="hero-tag inline-flex items-center gap-2 px-3 py-1 bg-brand-linen/60 rounded-full border border-brand-mist/40 mx-auto mb-6">
              <div className="hero-tag-dot bg-brand-terracotta"></div>
              <span className="text-xs uppercase tracking-widest text-brand-stone font-medium flex items-center gap-1">
                <MessageSquare size={12} className="text-brand-terracotta" /> Agendamento e WhatsApp
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-serif text-brand-ink leading-tight tracking-tight mb-6">
              Sistema de agendamento com WhatsApp para profissionais da beleza
            </h1>

            <p className="text-base sm:text-lg text-brand-stone max-w-2xl mx-auto mb-8 leading-relaxed font-light">
              Pare de responder as mesmas mensagens o dia inteiro. Com a Nera, suas clientes acessam sua vitrine própria, escolhem um horário ideal e você organiza tudo em uma agenda elegante.
            </p>

            <div className="hero-ctas-row justify-center !items-center mb-8">
              <Link to="/register" className="btn-primary">
                <span>Começar grátis</span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/p/helena-prado" className="btn-secondary-terra">
                Ver vitrine de exemplo
              </Link>
            </div>

            <div className="google-shortcut-container flex items-center justify-center gap-2 text-xs text-brand-stone">
              <span>Acesso rápido:</span>
              <button 
                onClick={handleGoogleAuth}
                disabled={loading}
                className="btn-google-shortcut inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-brand-mist/50 rounded-full hover:bg-brand-parchment/30 transition-colors"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-3.5 h-3.5" />
                <span className="font-medium text-brand-ink">Continuar com Google</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* THE PAIN */}
      <section className="py-20 bg-white">
        <div className="wrap">
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs tracking-[0.25em] text-brand-terracotta uppercase font-semibold block mb-3">— O desafio da rotina</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink mb-6">O que acontece quando você vive no WhatsApp?</h2>
              <div className="space-y-4 text-brand-stone font-light text-sm sm:text-base leading-relaxed">
                <p>
                  Você responde cliente no meio do atendimento, à noite, no intervalo ou no fim de semana, e ainda perde horários porque não conseguiu visualizar a tempo no turbilhão de mensagens.
                </p>
                <p>
                  Trocar 15 mensagens de "vai-e-vem" com cada cliente para acertar um único horário gasta uma energia preciosa que você deveria estar investindo no seu trabalho ou no seu descanso.
                </p>
              </div>
            </div>
            <div className="p-8 bg-brand-parchment/60 rounded-3xl border border-brand-mist/40 space-y-4">
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-xs">✗</div>
                <p className="text-brand-stone text-xs sm:text-sm font-light">"Você tem horário amanhã às 14h?"</p>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-xs">✗</div>
                <p className="text-brand-stone text-xs sm:text-sm font-light">"Não, amanhã só às 16h. Serve?"</p>
              </div>
              <div className="flex gap-4 items-start text-brand-stone/40">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-xs">...</div>
                <p className="text-xs sm:text-sm font-light">(3 horas depois...)</p>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 text-xs">✗</div>
                <p className="text-brand-stone text-xs sm:text-sm font-light">"Às 16h não consigo. E na sexta?"</p>
              </div>
              <p className="text-xs font-serif text-brand-terracotta font-medium text-center border-t border-brand-mist/40 pt-4">Nera elimina esse fluxo cansativo para sempre.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW NERA HELPS */}
      <section className="py-20 bg-[#F7F2EC]">
        <div className="wrap">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs tracking-[0.25em] text-brand-stone uppercase font-medium block mb-3">A solução</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink">Como a Nera simplifica sua vida</h2>
              <p className="text-brand-stone text-sm sm:text-base mt-2 font-light">Seu WhatsApp continua sendo o seu canal de ouro, mas sem o trabalho burocrático.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-6 bg-white rounded-2xl border border-brand-mist/30">
                <Smartphone className="text-brand-terracotta mb-4" size={24} />
                <h4 className="font-serif text-brand-ink mb-2">Sua vitrine exclusiva</h4>
                <p className="text-brand-stone text-xs font-light leading-relaxed">Suas clientes acessam um link bonito, veem fotos dos seus trabalhos, seus serviços e preços detalhados de forma profissional.</p>
              </div>

              <div className="p-6 bg-white rounded-2xl border border-brand-mist/30">
                <Calendar className="text-brand-terracotta mb-4" size={24} />
                <h4 className="font-serif text-brand-ink mb-2">Pedidos de horários</h4>
                <p className="text-brand-stone text-xs font-light leading-relaxed">A cliente escolhe o dia e horário que deseja. Você recebe o pedido organizado e confirma quando fizer sentido, mantendo o controle total.</p>
              </div>

              <div className="p-6 bg-white rounded-2xl border border-brand-mist/30">
                <Bell className="text-brand-terracotta mb-4" size={24} />
                <h4 className="font-serif text-brand-ink mb-2">Lembretes e mensagens</h4>
                <p className="text-brand-stone text-xs font-light leading-relaxed">No plano Pro, o sistema ajuda você a enviar confirmações e lembretes amigáveis de agendamento por e-mail ou WhatsApp, reduzindo as faltas ocultas.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS STEP-BY-STEP */}
      <section className="py-20 bg-white">
        <div className="wrap">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs tracking-[0.25em] text-brand-stone uppercase font-medium block mb-3">Passo a passo</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink">Um fluxo incrivelmente simples</h2>
            </div>

            <div className="space-y-8 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-brand-linen before:my-4">
              <div className="relative flex gap-6 items-start">
                <div className="w-8 h-8 rounded-full bg-brand-terracotta text-white flex items-center justify-center font-serif text-sm shrink-0 z-10">1</div>
                <div>
                  <h4 className="font-serif text-brand-ink text-base sm:text-lg mb-1">Você compartilha seu link</h4>
                  <p className="text-brand-stone text-sm font-light leading-relaxed">Coloque seu link exclusivo na bio do Instagram ou configure uma mensagem automática de recepção no WhatsApp.</p>
                </div>
              </div>

              <div className="relative flex gap-6 items-start">
                <div className="w-8 h-8 rounded-full bg-brand-terracotta text-white flex items-center justify-center font-serif text-sm shrink-0 z-10">2</div>
                <div>
                  <h4 className="font-serif text-brand-ink text-base sm:text-lg mb-1">A cliente escolhe horário e serviço</h4>
                  <p className="text-brand-stone text-sm font-light leading-relaxed">A cliente acessa sua página elegante, seleciona os serviços que deseja realizar e os horários que você determinou como disponíveis.</p>
                </div>
              </div>

              <div className="relative flex gap-6 items-start">
                <div className="w-8 h-8 rounded-full bg-brand-terracotta text-white flex items-center justify-center font-serif text-sm shrink-0 z-10">3</div>
                <div>
                  <h4 className="font-serif text-brand-ink text-base sm:text-lg mb-1">Você dá o aval com um clique</h4>
                  <p className="text-brand-stone text-sm font-light leading-relaxed">Você recebe o pedido e clica para aceitar. A Nera se encarrega de organizar tudo na sua grade de horários e marcar como ocupado.</p>
                </div>
              </div>

              <div className="relative flex gap-6 items-start">
                <div className="w-8 h-8 rounded-full bg-brand-terracotta text-white flex items-center justify-center font-serif text-sm shrink-0 z-10">4</div>
                <div>
                  <h4 className="font-serif text-brand-ink text-base sm:text-lg mb-1">Informações confirmadas</h4>
                  <p className="text-brand-stone text-sm font-light leading-relaxed">A sua cliente recebe as informações de confirmação e lembretes para não esquecer do compromisso.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPANION VISION */}
      <section className="py-20 bg-brand-parchment/40 border-y border-brand-mist/30">
        <div className="wrap">
          <div className="max-w-3xl mx-auto text-center">
            <span className="text-xs tracking-[0.25em] text-brand-stone uppercase font-medium block mb-3">— Menos robô, mais humano</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink mb-6">O WhatsApp continua sendo o seu maior canal</h2>
            <p className="text-brand-stone leading-relaxed font-light text-base sm:text-lg mb-6">
              A Nera não afasta você das suas clientes. Nós acreditamos que o atendimento humano e carinhoso é o segredo de uma profissional de beleza de sucesso.
            </p>
            <p className="text-brand-stone leading-relaxed font-light text-base sm:text-lg">
              Por isso, a Nera apenas tira de suas costas as perguntas chatas e repetitivas, como <em>"tem horário?"</em>, <em>"qual o valor do alongamento?"</em>, <em>"onde fica seu estúdio?"</em> ou <em>"que horas eu marquei mesmo?"</em>. Sobrando mais tempo para você conversar sobre o que realmente importa.
            </p>
          </div>
        </div>
      </section>

      {/* SERVES ALL PROFESSIONS */}
      <section className="py-20 bg-white">
        <div className="wrap">
          <div className="max-w-4xl mx-auto text-center">
            <span className="text-xs tracking-[0.25em] text-brand-stone uppercase font-medium block mb-3">Feita para você</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink mb-12">Uma agenda sob medida para sua especialidade</h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 text-left">
              {[
                "Nail Designers & Manicures",
                "Lash Designers",
                "Sobrancelhistas & Micropigmentadoras",
                "Esteticistas",
                "Cabeleireiras & Coloristas",
                "Maquiadoras",
                "Podólogas",
                "Massoterapeutas & Depiladoras"
              ].map((specialty, idx) => (
                <div key={idx} className="p-4 bg-brand-parchment/30 rounded-xl border border-brand-mist/20 flex gap-2 items-center">
                  <Check className="text-brand-terracotta shrink-0" size={14} />
                  <span className="text-brand-ink text-xs sm:text-sm font-medium">{specialty}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INTERNAL CONTEXTUAL LINKS */}
      <section className="py-16 bg-brand-linen/20 border-b border-brand-mist/30">
        <div className="wrap">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-xs uppercase tracking-[0.2em] text-brand-terracotta font-semibold block mb-2">Páginas de Especialidade</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink">Confira as soluções para seu nicho</h2>
              <p className="text-brand-stone text-sm sm:text-base mt-2 font-light">
                Veja como a Nera se adapta com precisão para cada área de atendimento.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white border border-brand-mist/40 rounded-3xl hover:border-brand-terracotta/45 transition-colors flex flex-col justify-between">
                <div>
                  <h4 className="font-serif text-lg text-brand-ink mb-2">Nail Designers</h4>
                  <p className="text-brand-stone text-xs leading-relaxed font-light mb-4">
                    Sua vitrine de unhas e alongamentos integrada ao WhatsApp.
                  </p>
                </div>
                <Link to="/para-nail-designers" className="text-brand-terracotta font-medium text-xs flex items-center gap-1 hover:text-brand-sienna transition-colors mt-auto">
                  <span>É nail designer? Veja a solução específica →</span>
                </Link>
              </div>

              <div className="p-6 bg-white border border-brand-mist/40 rounded-3xl hover:border-brand-terracotta/45 transition-colors flex flex-col justify-between">
                <div>
                  <h4 className="font-serif text-lg text-brand-ink mb-2">Lash Designers</h4>
                  <p className="text-brand-stone text-xs leading-relaxed font-light mb-4">
                    Atraia clientes de cílios com portfólio visual e reservas automatizadas.
                  </p>
                </div>
                <Link to="/para-lash-designers" className="text-brand-terracotta font-medium text-xs flex items-center gap-1 hover:text-brand-sienna transition-colors mt-auto">
                  <span>É lash designer? Veja a solução específica →</span>
                </Link>
              </div>

              <div className="p-6 bg-white border border-brand-mist/40 rounded-3xl hover:border-brand-terracotta/45 transition-colors flex flex-col justify-between">
                <div>
                  <h4 className="font-serif text-lg text-brand-ink mb-2">Esteticistas & Outros</h4>
                  <p className="text-brand-stone text-xs leading-relaxed font-light mb-4">
                    Reserve pacotes de estética e envie lembretes automáticos sem complicação.
                  </p>
                </div>
                <Link to="/para-esteticistas" className="text-brand-terracotta font-medium text-xs flex items-center gap-1 hover:text-brand-sienna transition-colors mt-auto">
                  <span>Conheça a solução para Estética →</span>
                </Link>
              </div>
            </div>

            <div className="mt-8 text-center bg-white border border-brand-mist/40 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left">
                <h4 className="font-serif text-base text-brand-ink mb-1">Como nos comparamos com outras soluções?</h4>
                <p className="text-brand-stone text-xs font-light">Entenda de forma transparente a diferença entre a Nera e sistemas tradicionais.</p>
              </div>
              <div className="flex gap-3 shrink-0">
                <Link to="/nera-vs-booksy" className="px-4 py-2 bg-brand-linen text-brand-ink hover:bg-brand-mist/30 transition-colors rounded-full text-xs font-medium border border-brand-mist/40">
                  Nera vs Booksy
                </Link>
                <Link to="/nera-vs-trinks" className="px-4 py-2 bg-brand-linen text-brand-ink hover:bg-brand-mist/30 transition-colors rounded-full text-xs font-medium border border-brand-mist/40">
                  Nera vs Trinks
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-brand-parchment/30 border-t border-brand-mist/30">
        <div className="wrap">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs tracking-[0.25em] text-brand-stone uppercase font-medium block mb-3">Dúvidas comuns</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink">Perguntas frequentes</h2>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border-b border-brand-mist/40 pb-4">
                  <button 
                    onClick={() => toggleFaq(idx)}
                    className="w-full flex items-center justify-between text-left py-2 hover:text-brand-terracotta transition-colors"
                  >
                    <span className="font-serif text-base sm:text-lg text-brand-ink">{faq.q}</span>
                    <ChevronDown size={18} className={`text-brand-stone transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`mt-2 text-brand-stone text-sm leading-relaxed font-light overflow-hidden transition-all duration-300 ${openFaq === idx ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                    {faq.a}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="cta" className="relative py-24 bg-brand-ink text-white text-center overflow-hidden">
        <div className="cta-bg-n opacity-5"><span>n</span></div>
        <div className="cta-inner max-w-2xl mx-auto relative z-10 px-6">
          <span className="text-xs tracking-[0.3em] uppercase text-brand-sienna font-medium block mb-3">Reduza seu tempo online</span>
          <h2 className="text-3xl sm:text-4xl font-serif leading-tight mb-6">
            Transforme seu link de WhatsApp em uma vitrine de agendamentos.
          </h2>
          <p className="text-brand-blush/80 max-w-md mx-auto mb-8 font-light text-sm sm:text-base">
            Dê adeus ao estresse de responder mensagens fora de hora e ao caos das anotações em papel.
          </p>
          <Link to="/register" className="btn-cta-main">
            <span>Começar minha agenda grátis</span>
            <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-brand-stone/70 mt-4">Nenhum cartão de crédito é exigido para o teste.</p>
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
            <div className="footer-col-title">Plataforma</div>
            <div className="footer-links">
              <Link to="/" className="footer-link">Como funciona</Link>
              <Link to="/planos" className="footer-link">Planos e preços</Link>
            </div>
          </div>
          <div>
            <div className="footer-col-title">Soluções</div>
            <div className="footer-links">
              <Link to="/para-nail-designers" className="footer-link">Nail Designers</Link>
              <Link to="/para-lash-designers" className="footer-link">Lash Designers</Link>
              <Link to="/para-sobrancelhistas" className="footer-link">Sobrancelhistas</Link>
              <Link to="/para-esteticistas" className="footer-link">Esteticistas</Link>
              <Link to="/para-cabeleireiras" className="footer-link">Cabeleireiras</Link>
            </div>
          </div>
          <div>
            <div className="footer-col-title">Comparações</div>
            <div className="footer-links">
              <Link to="/nera-vs-booksy" className="footer-link">Nera vs Booksy</Link>
              <Link to="/nera-vs-trinks" className="footer-link">Nera vs Trinks</Link>
              <Link to="/sistema-de-agendamento-whatsapp" className="footer-link">Agenda com WhatsApp</Link>
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
