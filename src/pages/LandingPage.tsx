import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  Calendar, Sparkles, Clock, ArrowRight, 
  CheckCircle2, ShieldCheck, Zap, TrendingUp,
  Instagram, MessageCircle, Smartphone, MousePointer2,
  Lock, Star
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-brand-cream">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-10 max-w-7xl mx-auto w-full relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-dark rounded-full flex items-center justify-center text-white">
            <Calendar size={20} />
          </div>
          <span className="text-2xl font-serif font-bold tracking-tight text-brand-dark">Marca Aí</span>
        </div>
        <div className="flex items-center gap-10">
          <Link to="/login" className="text-xs font-bold text-brand-gray uppercase tracking-widest hover:text-brand-dark transition-colors">
            Entrar
          </Link>
          <Link to="/register" className="bg-brand-dark text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-brand-dark/90 transition-all premium-shadow flex items-center gap-2">
            Criar Minha Agenda
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="px-6 pt-20 pb-40 max-w-7xl mx-auto w-full text-center relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-5xl md:text-[6.5rem] font-serif font-medium mb-10 leading-[0.95] tracking-tight text-brand-dark text-balance">
              Você responde mensagem o dia inteiro… <span className="italic text-brand-rose">e ainda perde cliente.</span>
            </h1>
            
            <p className="text-brand-gray text-xl md:text-2xl max-w-3xl mx-auto mb-16 leading-relaxed font-light">
              Organize sua agenda, reduza faltas e pare de viver no WhatsApp. 
              O sistema central para profissionais que valorizam seu tempo e seu lucro.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-20">
              <Link to="/register" className="w-full sm:w-auto bg-brand-dark text-white px-16 py-7 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-brand-dark/90 transition-all premium-shadow flex flex-col items-center gap-1 group">
                <span>Criar minha agenda grátis</span>
                <span className="text-[10px] opacity-40 font-normal tracking-normal normal-case">Sem cartão de crédito</span>
              </Link>
              <Link to="/p/bruna-boutique" className="w-full sm:w-auto bg-white text-brand-dark border border-brand-dark/10 px-12 py-7 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-brand-cream transition-all flex items-center justify-center gap-3">
                Ver Exemplo Real
              </Link>
            </div>

            {/* Social Proof Bar */}
            <div className="flex flex-col items-center gap-6 mb-32">
              <div className="flex -space-x-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="w-12 h-12 rounded-full border-4 border-brand-cream bg-brand-cream overflow-hidden">
                    <img src={`https://i.pravatar.cc/150?u=${i}`} alt="User" />
                  </div>
                ))}
              </div>
              <p className="label-text text-brand-gray">
                Mais de 500 profissionais já organizaram sua agenda com o Marca Aí
              </p>
              <div className="max-w-md bg-white p-6 rounded-3xl border border-brand-dark/5 premium-shadow italic text-sm text-brand-dark">
                "Minha agenda lotou depois desse link. Não perco mais tempo respondendo preço no WhatsApp."
                <span className="block mt-2 font-bold not-italic text-[10px] uppercase tracking-widest opacity-40">— Bruna, Designer de Cílios</span>
              </div>
            </div>
          </motion.div>

          {/* App Preview Mockup */}
          <div className="relative max-w-6xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 1 }}
              className="bg-white rounded-[4rem] shadow-2xl overflow-hidden border border-brand-dark/5 p-6"
            >
              <div className="bg-brand-cream rounded-[3rem] overflow-hidden border border-brand-dark/5 relative">
                <img 
                  src="https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=2000" 
                  alt="Marca Aí Dashboard" 
                  className="w-full h-auto opacity-90"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/20 to-transparent" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* Pain Points / Solution */}
        <section className="bg-white py-40 px-6">
          <div className="max-w-7xl mx-auto w-full">
            <div className="grid lg:grid-cols-2 gap-32 items-center">
              <div>
                <h2 className="text-5xl md:text-7xl font-serif font-medium mb-12 text-brand-dark leading-[1.1]">
                  Chega de <span className="italic text-brand-rose">caos</span> na sua agenda.
                </h2>
                <div className="space-y-12">
                  <div className="flex gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-brand-cream flex items-center justify-center text-brand-dark shrink-0">
                      <Smartphone size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">Agendamento 24/7</h3>
                      <p className="text-brand-gray leading-relaxed font-medium">Sua cliente agenda sozinha, mesmo quando você está atendendo ou dormindo. Sem idas e vindas no WhatsApp.</p>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-brand-cream flex items-center justify-center text-brand-dark shrink-0">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">Redução de Faltas</h3>
                      <p className="text-brand-gray leading-relaxed font-medium">Lembretes automáticos que profissionalizam seu serviço e garantem que a cliente não esqueça do compromisso.</p>
                    </div>
                  </div>
                  <div className="flex gap-6">
                    <div className="w-12 h-12 rounded-2xl bg-brand-cream flex items-center justify-center text-brand-dark shrink-0">
                      <TrendingUp size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">Visão Clara do Dinheiro</h3>
                      <p className="text-brand-gray leading-relaxed font-medium">Saiba exatamente quanto vai receber no dia, na semana e no mês. Controle financeiro sem planilhas chatas.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="absolute -inset-4 bg-brand-rose/5 rounded-[4rem] blur-3xl" />
                <div className="relative bg-brand-cream p-12 rounded-[4rem] border border-brand-dark/5">
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl premium-shadow flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-brand-rose-light" />
                        <div>
                          <p className="text-sm font-bold">Nova Reserva!</p>
                          <p className="text-[10px] text-brand-gray font-bold uppercase tracking-widest">Hoje às 16:30</p>
                        </div>
                      </div>
                      <span className="text-brand-rose font-bold">R$ 150</span>
                    </div>
                    <div className="bg-white p-6 rounded-3xl premium-shadow opacity-60 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-brand-rose-light" />
                        <div>
                          <p className="text-sm font-bold">Reserva Confirmada</p>
                          <p className="text-[10px] text-brand-gray font-bold uppercase tracking-widest">Amanhã às 09:00</p>
                        </div>
                      </div>
                      <span className="text-brand-rose font-bold">R$ 80</span>
                    </div>
                    <div className="bg-white p-6 rounded-3xl premium-shadow opacity-30 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-brand-rose-light" />
                        <div>
                          <p className="text-sm font-bold">Nova Reserva!</p>
                          <p className="text-[10px] text-brand-gray font-bold uppercase tracking-widest">Quarta às 11:00</p>
                        </div>
                      </div>
                      <span className="text-brand-rose font-bold">R$ 220</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-40 px-6 bg-brand-cream/50">
          <div className="max-w-7xl mx-auto w-full text-center">
            <h2 className="text-4xl md:text-6xl font-serif font-medium mb-24 text-brand-dark">Sua nova rotina em 3 passos</h2>
            <div className="grid md:grid-cols-3 gap-16">
              <div className="relative">
                <div className="text-[12rem] font-serif italic text-brand-rose/10 absolute -top-24 left-1/2 -translate-x-1/2 -z-10">1</div>
                <h3 className="text-2xl font-bold mb-4">Crie seu Perfil</h3>
                <p className="text-brand-gray font-medium">Configure seus serviços, horários e áreas de atendimento em minutos.</p>
              </div>
              <div className="relative">
                <div className="text-[12rem] font-serif italic text-brand-rose/10 absolute -top-24 left-1/2 -translate-x-1/2 -z-10">2</div>
                <h3 className="text-2xl font-bold mb-4">Compartilhe o Link</h3>
                <p className="text-brand-gray font-medium">Coloque seu link exclusivo na bio do Instagram e no seu WhatsApp.</p>
              </div>
              <div className="relative">
                <div className="text-[12rem] font-serif italic text-brand-rose/10 absolute -top-24 left-1/2 -translate-x-1/2 -z-10">3</div>
                <h3 className="text-2xl font-bold mb-4">Receba Reservas</h3>
                <p className="text-brand-gray font-medium">Acompanhe tudo pelo seu dashboard e foque no que você faz de melhor.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials / Social Proof */}
        <section className="py-40 px-6 bg-white">
          <div className="max-w-7xl mx-auto w-full">
            <div className="grid md:grid-cols-2 gap-20 items-center">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-6 pt-12">
                  <div className="bg-brand-cream p-8 rounded-[2.5rem] border border-brand-dark/5">
                    <div className="flex gap-1 text-brand-gold mb-4">
                      {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                    </div>
                    <p className="text-sm font-medium italic mb-6">"Minha agenda lotou depois que coloquei o link na bio. As clientes amam a facilidade."</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-dark">Bruna, Designer de Cílios</p>
                  </div>
                  <div className="bg-brand-dark p-8 rounded-[2.5rem] text-white">
                    <div className="flex gap-1 text-brand-rose mb-4">
                      {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                    </div>
                    <p className="text-sm font-medium italic mb-6">"O melhor investimento que fiz. Não perco mais tempo respondendo preço no direct."</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Carla, Esteticista</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-brand-rose p-8 rounded-[2.5rem] text-white">
                    <div className="flex gap-1 text-white/40 mb-4">
                      {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                    </div>
                    <p className="text-sm font-medium italic mb-6">"O controle financeiro é incrível. Agora sei exatamente quanto ganho por mês."</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">Juliana, Manicure</p>
                  </div>
                  <div className="bg-brand-cream p-8 rounded-[2.5rem] border border-brand-dark/5">
                    <div className="flex gap-1 text-brand-gold mb-4">
                      {[...Array(5)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
                    </div>
                    <p className="text-sm font-medium italic mb-6">"A função de atendimento em domicílio mudou meu jogo. Cobro a taxa certa agora."</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-dark">Aline, Maquiadora</p>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="text-5xl md:text-7xl font-serif font-medium mb-10 text-brand-dark">O que dizem as <span className="italic text-brand-rose">especialistas.</span></h2>
                <p className="text-brand-gray text-xl leading-relaxed font-light mb-12">
                  Mais de 500 profissionais já profissionalizaram seu atendimento com o Marca Aí. 
                  Junte-se à comunidade que valoriza o próprio tempo.
                </p>
                <Link to="/register" className="inline-flex items-center gap-3 text-brand-dark font-bold uppercase tracking-widest border-b-2 border-brand-rose pb-2 hover:text-brand-rose transition-all">
                  Começar agora <ArrowRight size={20} />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-40 px-6 bg-brand-dark text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] border border-white rounded-full" />
          </div>
          
          <div className="max-w-4xl mx-auto relative z-10">
            <h2 className="text-5xl md:text-8xl font-serif font-medium mb-12 leading-[0.95]">
              Pronta para o próximo nível?
            </h2>
            <p className="text-white/40 text-xl mb-16 max-w-2xl mx-auto font-light">
              Crie sua conta em 2 minutos e comece a receber agendamentos hoje mesmo.
            </p>
            <Link to="/register" className="inline-flex bg-brand-rose text-white px-16 py-8 rounded-full text-sm font-bold uppercase tracking-[0.2em] hover:bg-brand-rose/90 transition-all premium-shadow group">
              Criar Minha Agenda Grátis
              <ArrowRight size={20} className="ml-4 group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-20 px-6 border-t border-brand-dark/5 text-center bg-white">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-8 h-8 bg-brand-dark rounded-full flex items-center justify-center text-white">
            <Calendar size={16} />
          </div>
          <span className="text-xl font-serif font-bold tracking-tight text-brand-dark">Marca Aí</span>
        </div>
        <div className="flex flex-wrap justify-center gap-10 mb-12 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-gray">
          <Link to="#" className="hover:text-brand-dark transition-colors">Termos de Uso</Link>
          <Link to="#" className="hover:text-brand-dark transition-colors">Privacidade</Link>
          <Link to="#" className="hover:text-brand-dark transition-colors">Suporte</Link>
          <Link to="#" className="hover:text-brand-dark transition-colors">Instagram</Link>
        </div>
        <p className="text-brand-gray/40 text-[10px] font-bold uppercase tracking-widest">
          © 2024 Marca Aí. Feito para profissionais que valorizam excelência.
        </p>
      </footer>
    </div>
  );
}
