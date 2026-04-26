import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, Clock, MapPin, TrendingUp, 
  Smartphone, Star, ChevronRight, Check
} from 'lucide-react';
import Logo from '../components/Logo';

// Substituir por depoimentos reais antes de campanhas pagas.
const TESTIMONIALS_PLACEHOLDER = true;

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-brand-parchment">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-8 max-w-7xl mx-auto w-full relative z-20">
        <Logo />
        <div className="flex items-center gap-8">
          <Link to="/profissionais" className="hidden md:block text-[11px] font-medium text-brand-stone uppercase tracking-[0.15em] hover:text-brand-ink transition-colors">
            Encontrar Profissionais
          </Link>
          <Link to="/login" className="text-[11px] font-medium text-brand-stone uppercase tracking-[0.15em] hover:text-brand-ink transition-colors">
            Entrar
          </Link>
          <Link to="/register" className="bg-brand-ink text-brand-white px-6 py-3 rounded-full text-[10px] font-medium uppercase tracking-[0.15em] hover:bg-brand-espresso transition-all">
            Fazer parte
          </Link>
        </div>
      </nav>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="px-6 pt-20 pb-32 max-w-7xl mx-auto w-full relative">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 bg-brand-linen border border-brand-mist px-4 py-2 rounded-full mb-10">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta" />
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-brand-terracotta">Para profissionais autônomas</span>
              </div>

              <h1 className="text-[56px] md:text-[88px] font-serif font-normal leading-[1.05] tracking-tight text-brand-ink mb-10 text-balance">
                Você responde o dia inteiro. <br />
                <span className="italic text-brand-terracotta">E ainda perde cliente.</span>
              </h1>
              
              <p className="text-brand-stone text-lg md:text-xl max-w-2xl mb-12 leading-relaxed font-light">
                Sua agenda inteligente que elimina o caos do WhatsApp e profissionaliza 
                seu faturamento com reservas automáticas e zero faltas.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
                <Link to="/register" className="w-full sm:w-auto bg-brand-ink text-brand-white px-10 py-6 rounded-full text-[11px] font-medium uppercase tracking-[0.15em] hover:bg-brand-espresso transition-all flex items-center justify-between gap-8 group">
                  <span>Começar grátis</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/p/helena-prado" className="w-full sm:w-auto bg-transparent text-brand-ink border border-brand-mist px-10 py-6 rounded-full text-[11px] font-medium uppercase tracking-[0.15em] hover:bg-brand-linen transition-all text-center">
                  Ver exemplo real →
                </Link>
              </div>

              <div className="flex items-center gap-4 pt-8 border-t border-brand-mist">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-brand-parchment bg-brand-blush flex items-center justify-center text-[10px] font-medium text-brand-terracotta">
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-brand-stone font-light">
                  <span className="font-medium text-brand-ink">+500 profissionais</span> já organizaram sua agenda com a nera
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Pain Points Section */}
        <section className="bg-brand-espresso py-32 px-6">
          <div className="max-w-7xl mx-auto w-full">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-sienna mb-6 block">O problema real</span>
            <h2 className="text-[42px] md:text-[56px] font-serif font-normal text-brand-white leading-tight mb-20 max-w-2xl">
              Chega de caos <br />
              <span className="italic text-brand-sienna">na sua agenda.</span>
            </h2>

            <div className="grid md:grid-cols-3 gap-12">
              {[
                { icon: <Smartphone size={20} />, text: "Suas clientes esperam resposta no WhatsApp antes de confirmar" },
                { icon: <Star size={20} />, text: "Clientes somem depois do primeiro atendimento — sem histórico, sem retorno" },
                { icon: <TrendingUp size={20} />, text: "Você não sabe quanto perdeu em faltas este mês" }
              ].map((item, i) => (
                <div key={i} className="flex gap-5 items-start">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-brand-sienna shrink-0">
                    {item.icon}
                  </div>
                  <p className="text-brand-white/60 text-sm leading-relaxed pt-2 font-light">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-brand-parchment py-32 px-6">
          <div className="max-w-7xl mx-auto w-full">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-terracotta mb-6 block">A solução</span>
            <h2 className="text-[42px] md:text-[56px] font-serif font-normal text-brand-ink leading-tight mb-20 max-w-3xl">
              Tudo para <span className="italic text-brand-terracotta">profissionalizar</span> seu negócio
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { 
                  title: "Reservas 24/7", 
                  desc: "Sua cliente reserva sozinha enquanto você atende ou dorme. Sem idas e vindas no WhatsApp.",
                  icon: <Clock size={24} />
                },
                { 
                  title: "Feita para domicílio", 
                  desc: "Bairros, taxas e deslocamento gerenciados automaticamente. A primeira agenda construída para quem vai até a cliente.",
                  icon: <MapPin size={24} />
                },
                { 
                  title: "Visão financeira clara", 
                  desc: "Saiba exatamente quanto vai receber hoje, esta semana e este mês. Sem planilha.",
                  icon: <TrendingUp size={24} />
                }
              ].map((feat, i) => (
                <div key={i} className="card-refined hover:border-brand-terracotta/30 group">
                  <div className="w-12 h-12 rounded-2xl bg-brand-linen border border-brand-mist flex items-center justify-center text-brand-terracotta mb-8 group-hover:bg-brand-terracotta group-hover:text-brand-white transition-all">
                    {feat.icon}
                  </div>
                  <h3 className="text-2xl font-serif font-normal text-brand-ink mb-4">{feat.title}</h3>
                  <p className="text-brand-stone text-sm leading-relaxed font-light">{feat.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Interactive Demo Section */}
        <section className="bg-brand-white py-32 px-6 overflow-hidden">
          <div className="max-w-7xl mx-auto w-full">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-terracotta mb-6 block">Vitrine Profissional</span>
                <h2 className="text-[42px] md:text-[56px] font-serif font-normal text-brand-ink leading-tight mb-8">
                  Veja como sua <br />
                  <span className="italic text-brand-terracotta">página pode ficar.</span>
                </h2>
                <p className="text-brand-stone text-lg mb-12 font-light leading-relaxed">
                  Uma página bonita, profissional e pronta para receber reservas. 
                  Dê à sua cliente a experiência de um salão de luxo, direto no link da sua bio.
                </p>

                <div className="space-y-6 mb-12">
                  {[
                    "Seus serviços organizados por categoria",
                    "Agenda automática integrada",
                    "Cálculo de taxa de serviço por bairro",
                    "Visual premium que valoriza seu trabalho",
                    "Funciona perfeitamente em qualquer celular"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-brand-linen flex items-center justify-center text-brand-terracotta">
                        <Check size={12} />
                      </div>
                      <span className="text-sm font-medium text-brand-stone uppercase tracking-tight">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <Link to="/register" className="w-full sm:w-auto bg-brand-ink text-white px-10 py-5 rounded-full text-[11px] font-bold uppercase tracking-widest hover:bg-brand-espresso transition-all shadow-lg text-center">
                    Criar a minha agora
                  </Link>
                  <Link to="/p/helena-prado" className="w-full sm:w-auto text-brand-ink font-bold text-[11px] uppercase tracking-widest hover:underline text-center">
                    Ver exemplo completo
                  </Link>
                </div>
              </div>

              <div className="relative">
                {/* Phone Mockup */}
                <motion.div 
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="relative mx-auto w-[320px] h-[640px] bg-brand-ink rounded-[60px] border-[8px] border-brand-ink shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden"
                >
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-brand-ink rounded-b-3xl z-30" />
                  
                  {/* Simulated Content Scroll */}
                  <motion.div 
                    animate={{ y: [0, -400, 0] }}
                    transition={{ 
                      duration: 20, 
                      repeat: Infinity, 
                      ease: "linear"
                    }}
                    className="w-full"
                  >
                    {/* Simulated Header */}
                    <div className="h-72 relative overflow-hidden">
                      <img 
                        src="https://i.imgur.com/gBdf3tO.png" 
                        alt="Helena Prado"
                        className="w-full h-full object-cover object-[center_25%]"
                      />
                      {/* Editorial Overlay */}
                      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-brand-ink/40 to-transparent z-10" />
                      <div className="absolute inset-x-0 bottom-0 p-8 pt-20 bg-gradient-to-t from-brand-ink/95 via-brand-ink/60 to-transparent z-10">
                        <h3 className="text-white font-serif text-[28px] leading-tight mb-1">Helena Prado</h3>
                        <p className="text-white/70 text-[10px] uppercase tracking-[0.25em] font-bold">Design de sobrancelhas</p>
                      </div>
                    </div>

                    {/* Simulated Content */}
                    <div className="p-8 bg-brand-white space-y-8 relative z-20 -mt-2">
                      <div className="flex items-center gap-4 py-3 border-b border-brand-mist/10">
                        <div className="flex items-center gap-1.5">
                          <Star size={11} className="text-brand-terracotta fill-brand-terracotta" />
                          <span className="text-[11px] font-bold text-brand-ink">4.9</span>
                        </div>
                        <div className="w-px h-3 bg-brand-mist/30" />
                        <span className="text-[10px] text-brand-stone font-bold uppercase tracking-[0.2em] opacity-80">+150 atendimentos</span>
                      </div>

                      <div className="space-y-4">
                        <div className="p-5 bg-white rounded-2xl border border-brand-mist/40 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] flex justify-between items-center group transition-all active:scale-[0.98]">
                          <div>
                            <div className="text-[12px] font-bold text-brand-ink uppercase tracking-tight">Design de sobrancelhas personalizado</div>
                            <div className="text-[10px] text-brand-terracotta font-bold uppercase mt-1.5">R$ 80</div>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-brand-linen flex items-center justify-center">
                            <ChevronRight size={14} className="text-brand-terracotta" />
                          </div>
                        </div>
                        
                        <div className="p-5 bg-white rounded-2xl border border-brand-mist/40 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)] flex justify-between items-center group transition-all active:scale-[0.98]">
                          <div>
                            <div className="text-[12px] font-bold text-brand-ink uppercase tracking-tight">Brow Lamination</div>
                            <div className="text-[10px] text-brand-terracotta font-bold uppercase mt-1.5">R$ 150</div>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-brand-linen flex items-center justify-center">
                            <ChevronRight size={14} className="text-brand-terracotta" />
                          </div>
                        </div>
                      </div>

                      <div className="pt-6 pb-4">
                        <div className="w-full bg-brand-ink text-white py-5 rounded-2xl text-[11px] font-bold uppercase tracking-[0.25em] text-center shadow-[0_20px_40px_-12px_rgba(18,17,17,0.3)]">
                          Agendar horário
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                {/* Floating Elements */}
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                  className="absolute -right-10 top-1/4 bg-white p-4 rounded-2xl shadow-xl border border-brand-mist z-40 hidden md:block"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                      <Check size={16} />
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-brand-ink">
                      Reserva Confirmada
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 5, repeat: Infinity }}
                  className="absolute -left-10 bottom-1/4 bg-brand-terracotta text-white p-4 rounded-2xl shadow-xl z-40 hidden md:block"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <Clock size={16} />
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest">
                      Agenda Lotada ✨
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* Planos */}
        <section className="bg-brand-parchment py-32 px-6">
          <div className="max-w-7xl mx-auto w-full">
            <div className="text-center mb-16">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-stone mb-4 block">Planos simples</span>
              <h2 className="text-[42px] md:text-[52px] font-serif font-normal text-brand-ink leading-tight">
                Comece grátis, <em className="italic text-brand-terracotta">cresça no seu ritmo.</em>
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* GRATUITO */}
              <div className="card-refined p-10">
                <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-stone mb-6">Gratuito</div>
                <div className="text-[52px] font-serif font-normal text-brand-ink leading-none mb-2">R$ 0</div>
                <div className="text-brand-stone text-sm font-light mb-8">Plano gratuito para começar com teste sem risco. Sem cartão de crédito.</div>
                <ul className="space-y-3 mb-10">
                  {[
                    'Perfil digital premium (foto, bio e serviços)', 
                    'Até 15 agendamentos por mês', 
                    'Aprovação manual (seu filtro)', 
                    'Link direto para bio'
                  ].map(f => (
                    <li key={f} className="text-sm text-brand-stone font-light flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="block text-center border border-brand-mist py-4 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] text-brand-stone hover:bg-brand-linen transition-all">
                  Criar conta grátis
                </Link>
              </div>

              {/* ESSENCIAL */}
              <div className="bg-brand-ink rounded-[32px] p-10 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-terracotta text-white text-[8px] font-bold uppercase tracking-[0.2em] px-4 py-1.5 rounded-full">Mais popular</span>
                </div>
                <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-terracotta mb-6">Essencial</div>
                <div className="text-[52px] font-serif font-normal text-brand-white leading-none mb-2">R$ 49</div>
                <div className="text-brand-stone text-sm font-light mb-8">por mês · cancele quando quiser</div>
                <ul className="space-y-3 mb-10">
                  {['Agendamentos ilimitados', 'Notificações WhatsApp', 'Lista de espera', 'Bloqueio de horários', 'Lembrete 24h anti-no-show', 'Histórico de clientes'].map(f => (
                    <li key={f} className="text-sm text-brand-white/70 font-light flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta shrink-0" />{f}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="block text-center bg-brand-terracotta text-white py-4 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-brand-sienna transition-all">
                  Começar grátis por 30 dias
                </Link>
              </div>

              {/* PRO */}
              <div 
                className="rounded-[32px] p-12 lg:p-14 border-2 border-[#C49A7A] shadow-[0_24px_60px_rgba(91,52,35,0.16)] bg-[#F3EDE7] relative"
              >
                <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-brand-terracotta mb-6">Pro</div>
                <div className="text-[52px] font-serif font-normal text-brand-ink leading-none mb-2">R$ 89</div>
                <div className="text-brand-stone text-sm font-light mb-8">por mês</div>
                <ul className="space-y-4 mb-10">
                  {['Tudo do Essencial', 'Cupons de desconto', 'Relatório mensal PDF', 'Link de indicação premiado', 'Badge Pro Nera na vitrine', 'Suporte prioritário'].map(f => (
                    <li key={f} className="text-sm text-brand-stone font-bold flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-terracotta shrink-0" />
                      <span className="uppercase tracking-tight">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link 
                  to="/register" 
                  className="block text-center bg-brand-terracotta text-white py-5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg hover:bg-brand-sienna transition-all"
                >
                  Quero o Pro
                </Link>
                <p className="text-[9px] text-brand-stone/60 font-bold uppercase tracking-[0.2em] text-center mt-6">Posicionamento de elite</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="bg-brand-white py-32 px-6">
          <div className="max-w-7xl mx-auto w-full">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-brand-stone mb-12 block text-center">O que dizem as profissionais</span>
            
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="bg-brand-ink p-10 rounded-[32px] text-brand-white">
                <div className="flex gap-1 text-brand-sienna mb-6">
                  {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
                </div>
                <p className="text-xl font-serif italic font-normal leading-relaxed mb-8">
                  "Minha página ficou com cara de marca grande. Minhas clientes amaram a facilidade de agendar sozinhas e eu parei de perder tempo no WhatsApp."
                </p>
                <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">
                  Karina M. · Nail Designer · São Paulo
                </div>
              </div>
              
              <div className="bg-brand-linen p-10 rounded-[32px] border border-brand-mist">
                <div className="flex gap-1 text-brand-terracotta mb-6">
                  {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
                </div>
                <p className="text-xl font-serif italic font-normal leading-relaxed mb-8 text-brand-ink">
                  "O sistema de taxa por bairro mudou tudo. Agora cobro o valor justo pelo meu deslocamento de forma automática e profissional."
                </p>
                <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-brand-stone">
                  Ana P. · Esteticista · Curitiba
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-brand-terracotta py-32 px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-[48px] md:text-[72px] font-serif font-normal text-brand-white leading-[1.1] mb-8">
              Pronta para o próximo nível?
            </h2>
            <p className="text-brand-white/70 text-lg mb-12 font-light">
              Crie sua conta em 2 minutos e comece a receber agendamentos hoje mesmo.
            </p>
            <Link to="/register" className="inline-flex w-full sm:w-auto bg-brand-white text-brand-terracotta px-12 py-6 rounded-full text-[11px] font-medium uppercase tracking-[0.15em] hover:bg-brand-parchment transition-all items-center justify-center gap-8 group">
              <span>Fazer parte da revolução</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="text-brand-white/40 text-[10px] uppercase tracking-[0.1em] mt-8">
              Sem cartão de crédito · Setup em 2 min · Cancele quando quiser
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-brand-ink py-20 px-6">
        <div className="max-w-7xl mx-auto w-full flex flex-col items-center">
          <Logo variant="dark" className="mb-12" />
          
          <div className="flex gap-10 mb-12">
            <Link to="/profissionais" className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/50 hover:text-brand-white transition-colors">
              Diretório
            </Link>
            {['Termos', 'Privacidade', 'Suporte', 'Instagram'].map((item) => (
              <Link key={item} to="#" className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/20 hover:text-brand-white transition-colors">
                {item}
              </Link>
            ))}
          </div>
          
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/10">
            © 2025 nera · Feito para profissionais que valorizam excelência
          </p>
        </div>
      </footer>
    </div>
  );
}
