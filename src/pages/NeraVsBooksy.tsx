import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../firebase';
import { notify } from '../lib/notify';
import SEOHead from '../components/SEOHead';
import { Check, X, HelpCircle, ChevronDown, Calendar, Users, Eye, ArrowRight, MessageSquare } from 'lucide-react';
import './LandingPage.css';

export default function NeraVsBooksy() {
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
      q: "A Nera é uma alternativa ao Booksy?",
      a: "Sim, especialmente para profissionais autônomas e pequenos estúdios que preferem uma vitrine digital própria e elegante em vez de competir em um marketplace aberto com dezenas de outros concorrentes na mesma região."
    },
    {
      q: "A Nera cobra comissão por agendamento?",
      a: "Não. Na Nera, 100% do valor dos seus serviços é seu. Nós cobramos apenas uma assinatura fixa mensal simples, sem taxas ocultas ou surpresas."
    },
    {
      q: "Minhas clientes precisam baixar aplicativo?",
      a: "Não. Suas clientes conseguem solicitar horários diretamente pelo navegador de qualquer celular ou computador, sem precisar baixar aplicativos ou criar contas complexas."
    },
    {
      q: "Posso usar a Nera pelo celular?",
      a: "Sim. A plataforma é totalmente otimizada para dispositivos móveis, permitindo que você controle sua agenda, finanças e clientes de onde estiver com extrema facilidade."
    },
    {
      q: "Posso começar grátis?",
      a: "Sim. A Nera oferece um período de testes gratuito sem compromisso para você experimentar todas as ferramentas e ver como ela se adapta ao seu dia a dia."
    },
    {
      q: "A Nera serve para nail designer, lash designer e esteticista?",
      a: "Com certeza. A Nera foi desenhada sob medida para as necessidades e a linguagem visual de profissionais independentes da beleza de todas as especialidades."
    }
  ];

  return (
    <div className="landing-page">
      <SEOHead 
        title="Nera ou Booksy: qual faz mais sentido para profissionais independentes?"
        description="Compare de forma honesta a Nera e o Booksy. Entenda as diferenças em autonomia, vitrine digital própria e experiência simples para você e suas clientes."
        canonical="https://usenera.com/nera-vs-booksy"
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
              <div className="hero-tag-dot bg-brand-terra"></div>
              <span className="text-xs uppercase tracking-widest text-brand-stone font-medium">Comparativo honesto</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-serif text-brand-ink leading-tight tracking-tight mb-6">
              Nera ou Booksy: qual faz mais sentido para profissionais da beleza independentes?
            </h1>

            <p className="text-base sm:text-lg text-brand-stone max-w-2xl mx-auto mb-8 leading-relaxed font-light">
              Compare uma plataforma pensada para a sua autonomia, com vitrine própria e rotina simples, com modelos mais voltados a marketplaces e grandes bases de clientes.
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

      {/* INTRO COMPARISON */}
      <section className="py-16 bg-[#FDFBF7] border-t border-brand-mist/20">
        <div className="wrap">
          <div className="max-w-3xl mx-auto text-center">
            <span className="text-xs tracking-[0.25em] text-brand-stone uppercase font-medium block mb-3">— Propósito</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink mb-6">Para quem essa comparação é útil?</h2>
            <p className="text-brand-stone leading-relaxed font-light text-base sm:text-lg">
              Se você quer organizar sua agenda, receber pedidos online e manter sua relação direta com suas clientes de forma independente, essa comparação ajuda a entender qual caminho combina melhor com sua rotina de atendimento e seu modelo de negócio.
            </p>
          </div>
        </div>
      </section>

      {/* COMPARATIVE TABLE */}
      <section className="py-20 bg-[#F7F2EC]">
        <div className="wrap">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-xs tracking-[0.25em] text-brand-stone uppercase font-medium block mb-3">Lado a lado</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink">A diferença principal</h2>
              <p className="text-brand-stone text-sm sm:text-base mt-2 font-light">Compare os principais recursos sob a ótica de quem atende por conta própria</p>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-brand-mist/50 bg-white shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-linen/40 border-b border-brand-mist/50">
                    <th className="p-6 text-xs uppercase tracking-wider text-brand-stone font-medium">Recurso</th>
                    <th className="p-6 text-xs uppercase tracking-wider text-brand-terra font-semibold">Nera (Vitrine Própria)</th>
                    <th className="p-6 text-xs uppercase tracking-wider text-brand-stone font-medium">Booksy (Marketplace)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-mist/30 text-sm">
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Foco principal</td>
                    <td className="p-6 text-brand-terra font-medium">Marca e autonomia da profissional independente</td>
                    <td className="p-6 text-brand-stone">Descoberta em marketplace e grandes operações</td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Vitrine própria</td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Link exclusivo, elegante e personalizado para colocar no Instagram</span>
                      </div>
                    </td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Perfil no diretório ao lado de outros concorrentes da região</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Experiência mobile</td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Totalmente responsivo pelo celular para profissional e clientes</span>
                      </div>
                    </td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Orientado a aplicativos móveis pesados que exigem download</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Relação com clientes</td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Direta, fortalecendo sua marca própria</span>
                      </div>
                    </td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Mediada pelo aplicativo do marketplace</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Simplicidade para autônomas</td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Configuração em 5 minutos, intuitivo e leve</span>
                      </div>
                    </td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <X className="text-red-500 shrink-0 mt-0.5" size={16} />
                        <span>Configurações densas pensadas para times ou recepção</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Gestão financeira</td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Visão clara e limpa de ganhos de forma descomplicada</span>
                      </div>
                    </td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Relatórios densos, úteis para grandes empresas</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Lista de espera</td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Lista de espera nativa para preencher cancelamentos rapidamente</span>
                      </div>
                    </td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Disponível em alguns planos mais caros</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="p-6 font-medium text-brand-ink">Curva de aprendizado</td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <Check className="text-green-600 shrink-0 mt-0.5" size={16} />
                        <span>Quase zero. Feito para profissionais que não gostam de sistemas complexos</span>
                      </div>
                    </td>
                    <td className="p-6 text-brand-stone">
                      <div className="flex items-start gap-2">
                        <X className="text-red-500 shrink-0 mt-0.5" size={16} />
                        <span>Exige treinamento inicial e tempo para habituação</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* WHY CHOOSE NERA */}
      <section className="py-20 bg-white">
        <div className="wrap">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <span className="text-xs uppercase tracking-wider text-brand-terra font-semibold block mb-2">Opção 01</span>
                <h3 className="text-2xl font-serif text-brand-ink mb-6">Quando a Nera faz mais sentido para você</h3>
                <ul className="space-y-4 text-brand-stone font-light text-sm sm:text-base">
                  <li className="flex items-start gap-3">
                    <span className="text-brand-terra shrink-0 mt-1">●</span>
                    <span>Você quer uma página de agendamento que pareça sua, transmitindo profissionalismo e elegância.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-brand-terra shrink-0 mt-1">●</span>
                    <span>Suas clientes já vêm do seu Instagram ou WhatsApp, e você quer apenas simplificar o agendamento sem dar comissões extras.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-brand-terra shrink-0 mt-1">●</span>
                    <span>Você quer gerenciar seus atendimentos de forma leve pelo celular, sem menus pesados ou excesso de burocracia.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-brand-terra shrink-0 mt-1">●</span>
                    <span>Você prefere uma plataforma intuitiva que suas clientes amam usar porque não exige que elas instalem nenhum aplicativo adicional.</span>
                  </li>
                </ul>
              </div>

              <div>
                <span className="text-xs uppercase tracking-wider text-brand-stone font-medium block mb-2">Opção 02</span>
                <h3 className="text-2xl font-serif text-brand-ink mb-6">Quando o Booksy faz mais sentido para você</h3>
                <ul className="space-y-4 text-brand-stone font-light text-sm sm:text-base">
                  <li className="flex items-start gap-3">
                    <span className="text-brand-stone/60 shrink-0 mt-1">●</span>
                    <span>Você depende majoritariamente de tráfego vindo de um marketplace aberto de pessoas procurando novas profissionais na sua região.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-brand-stone/60 shrink-0 mt-1">●</span>
                    <span>Você possui um grande salão de beleza com múltiplos profissionais contratados e precisa de um ERP robusto para faturamento detalhado.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-brand-stone/60 shrink-0 mt-1">●</span>
                    <span>Você e suas clientes dão preferência obrigatória a realizar todo o processo exclusivamente dentro de um aplicativo nativo para celular.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CORE VISION */}
      <section className="py-20 bg-brand-parchment/40 border-y border-brand-mist/30">
        <div className="wrap">
          <div className="max-w-3xl mx-auto text-center">
            <span className="text-xs tracking-[0.25em] text-brand-stone uppercase font-medium block mb-3">— O ponto principal</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink mb-6">Seus clientes são o seu maior ativo</h2>
            <p className="text-brand-stone leading-relaxed font-light text-base sm:text-lg mb-6">
              Muitos sistemas criam barreiras que afastam a cliente de você para aproximá-las do ecossistema deles. A Nera foi desenhada sob a premissa de que a relação com a cliente pertence unicamente a você.
            </p>
            <p className="text-brand-stone leading-relaxed font-light text-base sm:text-lg">
              Ajudamos a fortalecer a sua marca pessoal através de uma presença digital impecável, reduzindo mensagens manuais repetitivas sem nunca desumanizar o seu atendimento.
            </p>
          </div>
        </div>
      </section>

      {/* INTERNAL CONTEXTUAL LINKS */}
      <section className="py-16 bg-brand-linen/20 border-b border-brand-mist/30">
        <div className="wrap">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-xs uppercase tracking-[0.2em] text-brand-terra font-semibold block mb-2">Soluções Customizadas</span>
              <h2 className="text-2xl sm:text-3xl font-serif text-brand-ink">Feito sob medida para o seu nicho</h2>
              <p className="text-brand-stone text-sm sm:text-base mt-2 font-light">
                A Nera se adapta perfeitamente à linguagem visual e às necessidades de cada especialidade.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white border border-brand-mist/40 rounded-3xl hover:border-brand-terra/45 transition-colors flex flex-col justify-between">
                <div>
                  <h4 className="font-serif text-lg text-brand-ink mb-2">Nail Designers</h4>
                  <p className="text-brand-stone text-xs leading-relaxed font-light mb-4">
                    Gerencie decorações, manutenção e tempos de secagem com uma agenda sob seu controle.
                  </p>
                </div>
                <Link to="/para-nail-designers" className="text-brand-terra font-medium text-xs flex items-center gap-1 hover:text-brand-sienna transition-colors mt-auto">
                  <span>É nail designer? Veja a solução específica →</span>
                </Link>
              </div>

              <div className="p-6 bg-white border border-brand-mist/40 rounded-3xl hover:border-brand-terra/45 transition-colors flex flex-col justify-between">
                <div>
                  <h4 className="font-serif text-lg text-brand-ink mb-2">Lash Designers</h4>
                  <p className="text-brand-stone text-xs leading-relaxed font-light mb-4">
                    Ofereça agendamento elegante para extensões de cílios, manutenção e lashing com facilidade.
                  </p>
                </div>
                <Link to="/para-lash-designers" className="text-brand-terra font-medium text-xs flex items-center gap-1 hover:text-brand-sienna transition-colors mt-auto">
                  <span>É lash designer? Veja a solução específica →</span>
                </Link>
              </div>

              <div className="p-6 bg-white border border-brand-mist/40 rounded-3xl hover:border-brand-terra/45 transition-colors flex flex-col justify-between">
                <div>
                  <h4 className="font-serif text-lg text-brand-ink mb-2">Esteticistas & Outros</h4>
                  <p className="text-brand-stone text-xs leading-relaxed font-light mb-4">
                    Sistemas robustos de agendamento de pacotes, limpeza de pele e cuidados corporais.
                  </p>
                </div>
                <Link to="/para-esteticistas" className="text-brand-terra font-medium text-xs flex items-center gap-1 hover:text-brand-sienna transition-colors mt-auto">
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
      <section className="py-20 bg-white">
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
                    className="w-full flex items-center justify-between text-left py-2 hover:text-brand-terra transition-colors"
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
          <span className="text-xs tracking-[0.3em] uppercase text-brand-sienna font-medium block mb-3">Faça o teste</span>
          <h2 className="text-3xl sm:text-4xl font-serif leading-tight mb-6">
            Sua agenda com a sua cara, em poucos minutos.
          </h2>
          <p className="text-brand-blush/80 max-w-md mx-auto mb-8 font-light text-sm sm:text-base">
            Descubra como é ter uma presença digital simples e elegante que trabalha enquanto você atende.
          </p>
          <Link to="/register" className="btn-cta-main">
            <span>Começar grátis agora</span>
            <ArrowRight size={16} />
          </Link>
          <p className="text-xs text-brand-stone/70 mt-4">Nenhum cartão de crédito necessário para o teste gratuito.</p>
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
