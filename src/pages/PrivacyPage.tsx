import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function PrivacyPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans selection:bg-brand-rose/20 selection:text-brand-rose">
      <Helmet>
        <title>Política de Privacidade | Nera</title>
        <meta name="description" content="Política de Privacidade e uso de dados na plataforma Nera." />
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
          <p className="text-brand-rose font-medium tracking-wide text-sm mb-4 uppercase">Transparência</p>
          <h1 className="text-4xl md:text-5xl font-serif text-brand-stone tracking-tight mb-6">
            Política de Privacidade
          </h1>
          <p className="text-brand-stone/60">Última atualização: Maio de 2026</p>
        </div>

        <div className="prose prose-stone prose-lg max-w-none prose-p:text-brand-stone/80 prose-headings:font-serif prose-headings:text-brand-stone prose-a:text-brand-rose">
          <p>
            Na <strong>Nera</strong>, acreditamos que sua agenda e a relação com seus clientes merecem excelência, cuidado e máxima segurança. Esta Política de Privacidade descreve como coletamos, usamos e protegemos as informações quando profissionais e seus clientes interagem com a nossa plataforma.
          </p>

          <h2>1. Quais dados coletamos</h2>
          <p>Ao utilizar a Nera, coletamos os seguintes tipos de informações:</p>
          <ul>
            <li><strong>De profissionais:</strong> Dados de cadastro (nome, e-mail, telefone/WhatsApp), informações do negócio (serviços oferecidos, horários de funcionamento, preços, bio), dados financeiros processados de forma segura pelo Stripe e configurações de integrações (como token do Google Calendar, quando autorizado).</li>
            <li><strong>De clientes das profissionais:</strong> Dados inseridos no momento do agendamento (nome, número de telefone para contato via WhatsApp, e-mail para confirmações) e histórico de agendamentos.</li>
            <li><strong>Dados de uso e navegação:</strong> Informações automáticas de analytics (como páginas visitadas e interações no sistema) para nos ajudar a melhorar continuamente a plataforma, utilizando apenas dados estritamente necessários.</li>
          </ul>

          <h2>2. Como usamos os dados</h2>
          <p>A coleta dessas informações possui finalidades específicas:</p>
          <ul>
            <li>Fornecer a infraestrutura de vitrine digital, sistema de agendamento e gerenciamento de clientes.</li>
            <li>Permitir notificações cruciais para o funcionamento do serviço (ex: envio de confirmações e lembretes por WhatsApp/e-mail, notificações push).</li>
            <li>Processar de forma segura os pagamentos das assinaturas dos planos (via Stripe).</li>
            <li>Manter a segurança e prevenir fraudes contra as profissionais.</li>
          </ul>

          <h2>3. Os clientes da profissional</h2>
          <p>
            A Nera atua como provedora da infraestrutura técnica (operadora). A responsabilidade sobre o relacionamento e a coleta dos dados do cliente final perante a Lei Geral de Proteção de Dados (LGPD) primariamente pertence à <strong>profissional</strong> (controladora). Nós garantimos que esses dados serão utilizados pela Nera apenas para viabilizar as confirmações de agendamento e exibir o histórico na conta do profissional. Nunca venderemos dados dos seus clientes para terceiros.
          </p>

          <h2>4. Compartilhamento e Integrações</h2>
          <p>
            Não vendemos suas informações. Compartilhamos dados apenas com provedores essenciais para o funcionamento da plataforma:
          </p>
          <ul>
            <li><strong>Google Firebase:</strong> Nossa base de dados e sistema de autenticação segura.</li>
            <li><strong>Stripe:</strong> Onde são geridos todos os pagamentos e assinaturas de forma criptografada. Nenhum dado de cartão de crédito é armazenado na Nera.</li>
            <li><strong>Google Calendar:</strong> Se ativado pelo profissional, sincronizamos apenas as datas/horários dos blocos para evitar conflitos na sua vitrine.</li>
          </ul>

          <h2>5. Retenção e Segurança</h2>
          <p>
            Mantemos precauções e padrões técnicos de segurança do mercado para proteger suas informações pessoais contra perda, uso indevido, acesso não autorizado e alteração. Seu acesso é protegido mediante autenticação do Google, mantendo o ambiente da sua agenda seguro. Ao cancelar sua conta, você pode solicitar a remoção permanente do banco de dados das suas informações sensíveis.
          </p>

          <h2>6. Direitos do Titular (LGPD)</h2>
          <p>
            De acordo com a Lei Geral de Proteção de Dados do Brasil, você tem direito de solicitar o acesso, a correção e a exclusão dos seus dados pessoais que estejam sob nosso controle, bem como entender de forma transparente como estão sendo tratados. A Nera se compromete a honrar esses direitos prontamente.
          </p>

          <h2>7. Alterações nesta Política</h2>
          <p>
            Sempre que implementarmos novidades que exijam uma mudança nesta política, atualizaremos esta página. Se a mudança for significativa em relação ao uso de seus dados, notificaremos você ativamente pelo painel Nera ou por e-mail.
          </p>

          <h2>8. Fale Conosco</h2>
          <p>
            Se tiver qualquer dúvida sobre sua privacidade na Nera ou desejar exercer algum de seus direitos relativos aos dados, estamos à disposição. Entre em contato conosco através do e-mail: <strong>contato@usenera.com</strong>.
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
