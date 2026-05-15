import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function TermsPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans selection:bg-brand-rose/20 selection:text-brand-rose">
      <Helmet>
        <title>Termos de Uso | Nera</title>
        <meta name="description" content="Termos de uso aplicáveis à plataforma Nera." />
      </Helmet>

      {/* Basic Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7]/80 backdrop-blur-md border-b border-[#E8E1D9]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-brand-rose/10 flex items-center justify-center group-hover:bg-brand-rose/20 transition-colors">
              <Sparkles className="w-5 h-5 text-brand-rose" />
            </div>
            <span className="font-serif text-2xl font-medium text-brand-stone tracking-tight">Nera.</span>
          </Link>
          <Link to="/" className="flex items-center gap-2 text-brand-stone/60 hover:text-brand-stone transition-colors font-medium">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="pt-32 pb-24 max-w-3xl mx-auto px-6">
        <div className="mb-12">
          <p className="text-brand-rose font-medium tracking-wide text-sm mb-4 uppercase">Acordo legal</p>
          <h1 className="text-4xl md:text-5xl font-serif text-brand-stone tracking-tight mb-6">
            Termos de Uso
          </h1>
          <p className="text-brand-stone/60">Última atualização: Maio de 2026</p>
        </div>

        <div className="prose prose-stone prose-lg max-w-none prose-p:text-brand-stone/80 prose-headings:font-serif prose-headings:text-brand-stone prose-a:text-brand-rose">
          <p>
            Bem-vinda à <strong>Nera</strong>. Ao acessar nossa plataforma ou utilizar a infraestrutura da nossa vitrine de agendamentos, você concorda com estes termos. Este documento é claro e direto para estabelecer uma relação transparente de parceria.
          </p>

          <h2>1. O que é a Nera</h2>
          <p>
            A Nera é um software de gestão e uma vitrine digital (SaaS) desenhada exclusivamente para profissionais de beleza, estética e bem-estar. Nós fornecemos a tecnologia de hospedagem do seu perfil, sistema de marcações de horários e integrações; contudo, a Nera não realiza os serviços oferecidos e não atua em nome dos profissionais na prestação de serviço fim.
          </p>

          <h2>2. Cadastro e Responsabilidade da Profissional</h2>
          <p>Ao se cadastrar na Nera, você se compromete a:</p>
          <ul>
            <li>Fornecer dados reais, atualizados e autênticos.</li>
            <li>Manter sua conta segura, evitando o compartilhamento de acessos do Google para terceiros.</li>
            <li>Publicar apenas os serviços que você está habilitada a realizar profissionalmente, estipulando preços justos e políticas de cancelamento claras aos seus clientes.</li>
          </ul>

          <h2>3. Pagamentos e Assinaturas</h2>
          <p>
            Oferecemos planos de assinatura que garantem os recursos premium, como lembretes automáticos e inteligência artificial. 
          </p>
          <ul>
            <li>As cobranças, quando realizadas no plano pago, são processadas por intermédio da Stripe.</li>
            <li>Cancelamentos e interrupções de renovação do plano podem ser feitos a qualquer momento dentro do painel. Uma vez pago, o ciclo ficará ativo até a sua data de expiração, e não devolvemos pró-rata por cancelamentos que aconteçam no meio do mês, a menos que determinado por lei.</li>
          </ul>
          
          <h2>4. Sobre os clientes e os agendamentos</h2>
          <p>
            Ao utilizar o sistema de agendamento (Nera Vitrine):
          </p>
          <ul>
            <li>Você é a responsável oficial pelos serviços ofertados. Caso precise desmarcar com uma cliente, é de sua responsabilidade realizar esse aviso prático a ela, inclusive através do nosso painel de gerenciamento.</li>
            <li>A Nera fornecerá o SMS/WhatsApp e E-mail automatizado seguindo conformidade dos planos, não garantindo entrega absoluta devido a naturezas de infraestrutura de operadoras terceiras, ainda que trabalhemos ativamente para a máxima disponibilidade.</li>
          </ul>

          <h2>5. Condutas Proibidas</h2>
          <p>Na Nera, não permitimos o uso da nossa plataforma para:</p>
          <ul>
            <li>Oferta de serviços ilegais no território brasileiro, falsos ou não descritos na política de beleza e bem-estar.</li>
            <li>Disseminação de conteúdo ofensivo, violento, preconceituoso ou explícito nas vitrines.</li>
            <li>Explorar brechas no nosso software, fazer scraping indevido do diretório de profissionais ou subverter limitações dos planos (criação excessiva de múltiplas contas burlando bloqueios).</li>
          </ul>
          <p>A Nera reserva o direito de suspender agendamentos ou cancelar prontamente contas que violem este termo, preservando a integridade do restante da rede.</p>

          <h2>6. Limitação de Responsabilidade</h2>
          <p>
            A infraestrutura da Nera é arquitetada nas nuvens mais seguras. Todavia, como qualquer software, não podemos garantir 100% de disponibilidade todos os dias (em casos de queda extrema da infraestrutura global), e não somos responsáveis legalmente ou financeiramente por perdas e lucros cessantes decorrentes do uso contínuo ou da pausa dos serviços. Trabalhamos ininterruptamente para sustentar a nossa comunidade. Além disso, não nos responsabilizamos pela relação comercial e pelo contato final gerado entre profissional e cliente através dos nossos portais.
          </p>

          <h2>7. Modificações nestes Termos</h2>
          <p>
            Para refinar nosso serviço e proteger você, poderemos periodicamente alterar estes Termos. Enviaremos notificações nos painéis quando ajustes relevantes passarem a valer. O acesso ao sistema após a promulgação consolida sua transparência e acordo.
          </p>

          <h2>8. Fale Conosco</h2>
          <p>
            Dúvidas, reclamações sobre condutas, solicitações para remover algo da Nera ou para relatar uma conduta: por favor comunique-se no e-mail: <strong>contato@usenera.com</strong>.
          </p>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-[#E8E1D9] bg-[#FAF8F5] py-12">
        <div className="max-w-7xl mx-auto px-6 text-center text-brand-stone/50 text-sm">
          <p>© 2026 Nera · Feita com intenção no Brasil 🇧🇷</p>
        </div>
      </footer>
    </div>
  );
}
