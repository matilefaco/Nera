import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, Clock, MapPin, TrendingUp, 
  Smartphone, Star, ChevronRight, Check
} from 'lucide-react';
import Logo from '../components/Logo';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-brand-parchment">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-8 max-w-7xl mx-auto w-full relative z-20">
        <Logo />
        <div className="flex items-center gap-8">
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
                O sistema central para profissionais de beleza com atendimento em domicílio. 
                Reservas inteligentes, zero WhatsApp, zero falta.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
                <Link to="/register" className="w-full sm:w-auto bg-brand-ink text-brand-white px-10 py-6 rounded-full text-[11px] font-medium uppercase tracking-[0.15em] hover:bg-brand-espresso transition-all flex items-center justify-between gap-8 group">
                  <span>Criar minha marca grátis</span>
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
                  "Minha agenda lotou depois que coloquei o link na bio. Não perco mais tempo respondendo preço no direct."
                </p>
                <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/30">
                  Bruna, Designer de Cílios · Fortaleza
                </div>
              </div>
              
              <div className="bg-brand-linen p-10 rounded-[32px] border border-brand-mist">
                <div className="flex gap-1 text-brand-terracotta mb-6">
                  {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
                </div>
                <p className="text-xl font-serif italic font-normal leading-relaxed mb-8 text-brand-ink">
                  "A função de domicílio mudou tudo. Cobro a taxa certa em cada bairro, automático."
                </p>
                <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-brand-stone">
                  Aline, Maquiadora · Fortaleza
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
              Sem cartão · Setup em 2 min · Cancele quando quiser
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-brand-ink py-20 px-6">
        <div className="max-w-7xl mx-auto w-full flex flex-col items-center">
          <Logo variant="dark" className="mb-12" />
          
          <div className="flex gap-10 mb-12">
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
