import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { notify } from '../lib/notify';
import SEOHead from '../components/SEOHead';
import { Check, X, HelpCircle, ChevronDown, Calendar, Users, Eye, ArrowRight } from 'lucide-react';
import './LandingPage.css';

export default function NeraVsTrinks() {
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
      q: "A Nera substitui o Trinks?",
      a: "Para profissionais autônomas e pequenos estúdios de beleza, sim. A Nera substitui perfeitamente, oferecendo uma experiência infinitamente mais moderna, rápida e simplificada sem as dezenas de tabelas de configuração complexas que um sistema para grandes salões exige."
    },
    {
      q: "Preciso migrar todos os meus dados manualmente?",
      a: "A configuração inicial da Nera é tão rápida que você consegue cadastrar seus serviços e horários em menos de 5 minutos, direto pelo seu próprio celular, sem complicação."
    },
    {
      q: "Posso usar a Nera só como agenda?",
      a: "Sim. Você pode usar a Nera tanto para registrar seus agendamentos manuais do dia a dia quanto para receber pedidos de horários automáticos das suas clientes através do seu link exclusivo."
    },
    {
      q: "A Nera funciona para profissionais independentes?",
      a: "Sim. Ela foi construída exclusivamente para esse público. Ao contrário de sistemas tradicionais que tentam servir a grandes redes e autônomas ao mesmo tempo, nós focamos 100% na realidade de quem trabalha por conta própria."
    },
    {
      q: "Minhas clientes precisam instalar algum aplicativo?",
      a: "Não. Esse é um dos maiores diferenciais. Suas clientes agendam horários por uma página elegante e leve que abre no navegador de qualquer celular, de forma rápida e intuitiva."
    },
    {
      q: "Posso fazer um teste grátis?",
      a: "Sim. Você pode criar sua conta e experimentar todos os recursos da Nera gratuitamente por um período de testes, sem precisar informar dados de cartão de crédito."
    }
  ];

  return (
    <div className="landing-page">
      <SEOHead 
        title="Nera ou Trinks: compare duas formas de organizar sua agenda de beleza"
        description="Compare de forma objetiva a Nera e o Trinks. Entenda qual plataforma de agendamento combina melhor com o dia a dia da profissional de beleza independente."
        canonical="https://usenera.com/nera-vs-trinks"
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
              <span className="text-xs uppercase tracking-widest text-brand-stone font-medium">Comparativo objetivo</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-serif text-brand-ink leading-tight tracking-tight mb-6">
              Nera ou Trinks: compare duas formas de organizar sua agenda de beleza
            </h1>

            <p className="text-base sm:text-lg text-brand-stone max-w-2xl mx-auto mb-8 leading-relaxed font-light">
              Veja quando faz sentido escolher uma plataforma leve, visual e focada especificamente na rotina da profissional independente ou pequeno estúdio de beleza.
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

      {/* QUICK COMPARISON */}
      <section className="py-20 bg-[#FDFBF7] border-t border-brand-mist/20">
        <div className="wrap">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs tracking-[0.25em] text-brand-stone uppercase font-medium block mb-3">Lado a lado</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink">Comparativo rápido</h2>
              <p className="text-brand-stone text-sm sm:text-base mt-2 font-light">Entenda de forma clara os pontos fortes de cada proposta</p>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-brand-mist/50 bg-white shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-linen/40 border-b border-brand-mist/50">
                    <th className="p-6 text-xs uppercase tracking-wider text-brand-stone font-medium">Critério</th>
                    <th className="p-6 text-xs uppercase tracking-wider text-brand-terracotta font-semibold">Nera (Design e Leveza)</th>
                    <th className="p-6 text-xs uppercase tracking-wider text-brand-stone font-medium">Trinks (ERP e Tradicional)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-mist/30 text-sm">
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Público principal</td>
                    <td className="p-6 text-brand-terracotta font-medium">Profissionais autônomas e pequenos estúdios</td>
                    <td className="p-6 text-brand-stone">Salões de grande porte, franquias e redes</td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Facilidade para começar</td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Instantâneo. Você se cadastra e já começa a usar no celular</span>
                      </div>
                    </td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <X className="text-red-500 shrink-0 mt-0.5" size={16} />
                        <span>Complexo. Demanda configuração de taxas, comissões e logins</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Vitrine pública</td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Página elegante e premium com fotos, serviços e avaliações</span>
                      </div>
                    </td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Listagem no portal Trinks junto com outros salões</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Experiência mobile</td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Excepcional. Feito pensando na agilidade do uso móvel diário</span>
                      </div>
                    </td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <X className="text-red-500 shrink-0 mt-0.5" size={16} />
                        <span>Painel mais denso, otimizado para telas de computadores</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Financeiro</td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Fluxo de caixa intuitivo para controlar suas entradas rapidamente</span>
                      </div>
                    </td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Controle complexo de estoque, comissão de funcionários e impostos</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Identidade visual</td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Design clean, minimalista e focado em passar sofisticação</span>
                      </div>
                    </td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <X className="text-red-500 shrink-0 mt-0.5" size={16} />
                        <span>Visual tradicional com muitos dados e elementos visuais densos</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FOR WHO IT IS DESIGNED */}
      <section className="py-20 bg-[#F7F2EC]">
        <div className="wrap">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs tracking-[0.25em] text-brand-stone uppercase font-medium block mb-3">Filosofia</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink">Para quem a Nera foi pensada?</h2>
              <p className="text-brand-stone max-w-2xl mx-auto mt-4 font-light leading-relaxed">
                A Nera foi criada para profissionais que querem uma ferramenta bonita, simples e objetiva para atender melhor sem transformar a rotina do seu negócio próprio em burocracia ou complexidade desnecessária.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mt-12">
              <div className="p-8 bg-white rounded-3xl border border-brand-mist/40">
                <h3 className="text-xl font-serif text-brand-ink mb-4">Simplicidade como diferencial</h3>
                <p className="text-brand-stone font-light leading-relaxed text-sm">
                  Comece sem precisar passar por tutoriais demorados ou configurações exaustivas. Na Nera, você cria seus serviços, define seus horários de trabalho e já tem uma vitrine digital impecável pronta para divulgar em suas redes sociais. Tudo simples, limpo e direto.
                </p>
              </div>

              <div className="p-8 bg-white rounded-3xl border border-brand-mist/40">
                <h3 className="text-xl font-serif text-brand-ink mb-4">Quando o Trinks faz mais sentido?</h3>
                <p className="text-brand-stone font-light leading-relaxed text-sm">
                  Se você possui uma recepção dedicada, gerencia uma equipe numerosa com regras complexas de divisão de comissões, opera controle de estoque de cosméticos para revenda ou se sua equipe está habituada com fluxos tradicionais de ERPs de beleza, o Trinks possui as ferramentas administrativas indicadas para essa complexidade.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY INDEPENDENT PREFER NERA */}
      <section className="py-20 bg-white">
        <div className="wrap">
          <div className="max-w-3xl mx-auto text-center">
            <span className="text-xs tracking-[0.25em] text-brand-stone uppercase font-medium block mb-3">— Autonomia</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink mb-6">Por que profissionais autônomas preferem a Nera</h2>
            <div className="grid sm:grid-cols-2 gap-6 text-left mt-12">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-linen/60 text-brand-terracotta flex items-center justify-center shrink-0 font-medium">1</div>
                <div>
                  <h4 className="font-serif text-brand-ink mb-2">Menos complexidade</h4>
                  <p className="text-brand-stone text-xs font-light leading-relaxed">Sem dezenas de relatórios confusos que você nunca vai abrir. Apenas o que importa para o seu dia a dia.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-linen/60 text-brand-terracotta flex items-center justify-center shrink-0 font-medium">2</div>
                <div>
                  <h4 className="font-serif text-brand-ink mb-2">Foco na sua marca própria</h4>
                  <p className="text-brand-stone text-xs font-light leading-relaxed">Sua cliente interage com a sua marca e a sua vitrine digital, fortalecendo a sua relação de fidelização.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-linen/60 text-brand-terracotta flex items-center justify-center shrink-0 font-medium">3</div>
                <div>
                  <h4 className="font-serif text-brand-ink mb-2">Experiência mais moderna</h4>
                  <p className="text-brand-stone text-xs font-light leading-relaxed">Visual clean que valoriza as fotos dos seus trabalhos e transmite sofisticação às suas clientes.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-linen/60 text-brand-terracotta flex items-center justify-center shrink-0 font-medium">4</div>
                <div>
                  <h4 className="font-serif text-brand-ink mb-2">Sua agenda pelo celular</h4>
                  <p className="text-brand-stone text-xs font-light leading-relaxed">Adicione agendamentos manuais em segundos, envie lembretes amigáveis e controle seu caixa na palma da mão.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTERNAL CONTEXTUAL LINKS */}
      <section className="py-16 bg-brand-linen/20 border-b border-brand-mist/30">
        <div className="wrap">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-xs uppercase tracking-[0.2em] text-brand-terracotta font-semibold block mb-2">Soluções Customizadas</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink">Feito sob medida para o seu nicho</h2>
              <p className="text-brand-stone text-sm sm:text-base mt-2 font-light">
                A Nera se adapta perfeitamente à linguagem visual e às necessidades de cada especialidade.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white border border-brand-mist/40 rounded-3xl hover:border-brand-terracotta/45 transition-colors flex flex-col justify-between">
                <div>
                  <h4 className="font-serif text-lg text-brand-ink mb-2">Nail Designers</h4>
                  <p className="text-brand-stone text-xs leading-relaxed font-light mb-4">
                    Gerencie decorações, manutenção e tempos de secagem com uma agenda sob seu controle.
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
                    Ofereça agendamento elegante para extensões de cílios, manutenção e lashing com facilidade.
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
                    Sistemas robustos de agendamento de pacotes, limpeza de pele e cuidados corporais.
                  </p>
                </div>
                <Link to="/para-esteticistas" className="text-brand-terracotta font-medium text-xs flex items-center gap-1 hover:text-brand-sienna transition-colors mt-auto">
                  <span>Conheça a solução para Estética →</span>
                </Link>
              </div>
            </div>

            <div className="mt-8 text-center bg-white border border-brand-mist/40 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-left">
                <h4 className="font-serif text-base text-brand-ink mb-1">Prefere automação direto no WhatsApp?</h4>
                <p className="text-brand-stone text-xs font-light">Use o link inteligente da Nera na sua bio para automatizar pedidos e enviar lembretes automáticos.</p>
              </div>
              <Link to="/sistema-de-agendamento-whatsapp" className="shrink-0 px-5 py-2.5 bg-brand-linen text-brand-ink hover:bg-brand-mist/30 transition-colors rounded-full text-xs font-medium border border-brand-mist/40">
                Ver Sistema de WhatsApp
              </Link>
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
          <span className="text-xs tracking-[0.3em] uppercase text-brand-sienna font-medium block mb-3">Crie sua conta</span>
          <h2 className="text-3xl sm:text-4xl font-serif leading-tight mb-6">
            Sua vitrine e agenda prontas em poucos minutos.
          </h2>
          <p className="text-brand-blush/80 max-w-md mx-auto mb-8 font-light text-sm sm:text-base">
            Descubra a tranquilidade de ter um sistema simples que trabalha para você enquanto você cuida das suas clientes.
          </p>
          <Link to="/register" className="btn-cta-main">
            <span>Criar minha agenda grátis</span>
            <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-brand-stone/70 mt-4">Cancele quando quiser · Sem fidelidade ou taxas de cancelamento.</p>
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
