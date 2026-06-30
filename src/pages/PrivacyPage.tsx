import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

export default function PrivacyPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans selection:bg-brand-terracotta/20 selection:text-brand-ink">
      <Helmet>
        <title>Política de Privacidade | Nera</title>
        <meta name="description" content="Política de Privacidade e uso de dados na plataforma Nera." />
      </Helmet>

      {/* Basic Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7]/80 backdrop-blur-md border-b border-[#E8E1D9]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-brand-terracotta/10 flex items-center justify-center group-hover:bg-brand-terracotta/20 transition-colors">
              <Sparkles className="w-5 h-5 text-brand-terracotta" />
            </div>
            <span className="font-serif text-2xl font-medium text-brand-stone tracking-tight">Nera.</span>
          </Link>
          <Link to="/" className="flex items-center gap-2 text-brand-stone/60 hover:text-brand-stone transition-colors font-medium text-sm">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao início
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="pt-36 pb-24 max-w-[720px] mx-auto px-6 md:px-8">
        <div className="mb-14 pb-8 border-b border-brand-mist/40">
          <p className="text-brand-terracotta font-medium tracking-[0.2em] text-xs mb-3 uppercase">Transparência</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif text-brand-ink tracking-tight mb-5 leading-tight">
            Política de Privacidade
          </h1>
          <p className="text-brand-stone/50 text-xs sm:text-sm italic">Última atualização: Maio de 2026</p>
        </div>

        <div className="text-brand-stone/90 text-sm sm:text-base leading-relaxed space-y-7 font-sans">
          <p className="text-brand-ink/90 text-[15px] sm:text-[17px] leading-relaxed font-light font-serif italic mb-8">
            Na <strong className="font-semibold text-brand-ink">Nera</strong>, acreditamos que sua agenda e a relação com seus clientes merecem excelência, cuidado e máxima segurança. Esta Política de Privacidade descreve como coletamos, usamos e protegemos as informações quando profissionais e seus clientes interagem com a nossa plataforma.
          </p>

          <h2 className="text-xl sm:text-2xl font-serif text-brand-ink font-semibold tracking-tight mt-10 pt-4 pb-2 border-b border-brand-mist/40">
            1. Quais dados coletamos
          </h2>
          <p>Ao utilizar a Nera, coletamos os seguintes tipos de informações:</p>
          <ul className="space-y-3.5 pl-5 list-disc marker:text-brand-terracotta/50 text-brand-stone/85 my-4">
            <li><strong className="font-semibold text-brand-ink">De profissionais:</strong> Dados de cadastro (nome, e-mail, telefone/WhatsApp), informações do negócio (serviços oferecidos, horários de funcionamento, preços, bio), dados financeiros processados de forma segura pelo Stripe e configurações de integrações (como token do Google Calendar, quando autorizado).</li>
            <li><strong className="font-semibold text-brand-ink">De clientes das profissionais:</strong> Dados inseridos no momento do agendamento (nome, número de telefone para contato via WhatsApp, e-mail para confirmações) e histórico de agendamentos.</li>
            <li><strong className="font-semibold text-brand-ink">Dados de uso e navegação:</strong> Coletamos informações técnicas e de interação, como páginas visitadas, eventos de navegação, tipo de dispositivo, navegador, origem de acesso e interações realizadas na plataforma. Esses dados nos ajudam a melhorar a experiência, identificar erros, proteger a plataforma e aprimorar os recursos oferecidos.</li>
          </ul>

          <h2 className="text-xl sm:text-2xl font-serif text-brand-ink font-semibold tracking-tight mt-10 pt-4 pb-2 border-b border-brand-mist/40">
            2. Como usamos os dados
          </h2>
          <p>A coleta dessas informações possui finalidades específicas:</p>
          <ul className="space-y-3 pl-5 list-disc marker:text-brand-terracotta/50 text-brand-stone/85 my-4">
            <li>Fornecer a infraestrutura de vitrine digital, sistema de agendamento e gerenciamento de clientes.</li>
            <li>Permitir notificações cruciais para o funcionamento do serviço (ex: envio de confirmações e lembretes por WhatsApp/e-mail, notificações push).</li>
            <li>Processar de forma segura os pagamentos das assinaturas dos planos (via Stripe).</li>
            <li>Manter a segurança e prevenir fraudes contra as profissionais.</li>
          </ul>

          <h2 className="text-xl sm:text-2xl font-serif text-brand-ink font-semibold tracking-tight mt-10 pt-4 pb-2 border-b border-brand-mist/40">
            3. Base Legal para Tratamento de Dados
          </h2>
          <p>
            A Nera realiza o tratamento de dados pessoais com fundamento nas bases legais previstas pela Lei Geral de Proteção de Dados (LGPD), incluindo:
          </p>
          <ul className="space-y-3 pl-5 list-disc marker:text-brand-terracotta/50 text-brand-stone/85 my-4">
            <li>execução do contrato e prestação dos serviços contratados;</li>
            <li>cumprimento de obrigações legais e regulatórias;</li>
            <li>exercício regular de direitos;</li>
            <li>legítimo interesse para melhoria da plataforma, segurança e prevenção de fraudes;</li>
            <li>consentimento do usuário, quando aplicável.</li>
          </ul>
          <p>
            Sempre tratamos apenas os dados necessários para cada finalidade e adotamos medidas para proteger a privacidade dos usuários e clientes das profissionais que utilizam a plataforma.
          </p>

          <h2 className="text-xl sm:text-2xl font-serif text-brand-ink font-semibold tracking-tight mt-10 pt-4 pb-2 border-b border-brand-mist/40">
            4. Cookies e Tecnologias Semelhantes
          </h2>
          <p>
            Utilizamos cookies e tecnologias semelhantes para manter a plataforma funcionando corretamente, preservar sessões de acesso, reforçar a segurança, compreender o uso da Nera e melhorar continuamente a experiência dos usuários.
          </p>
          <p>
            Também podemos utilizar ferramentas de análise, como Microsoft Clarity, para entender como as pessoas interagem com nossas páginas, identificar dificuldades de navegação e aprimorar nossos serviços. Essas informações são utilizadas de forma agregada ou técnica, com a finalidade de melhoria, segurança e evolução da plataforma.
          </p>
          <p>
            O usuário pode gerenciar cookies diretamente nas configurações do seu navegador. Alguns cookies necessários, no entanto, podem ser essenciais para o funcionamento adequado da plataforma.
          </p>

          <h2 className="text-xl sm:text-2xl font-serif text-brand-ink font-semibold tracking-tight mt-10 pt-4 pb-2 border-b border-brand-mist/40">
            5. Os clientes da profissional
          </h2>
          <p>
            A Nera atua como provadora da infraestrutura técnica (operadora). A responsabilidade sobre o relacionamento e a coleta dos dados do cliente final perante a Lei Geral de Proteção de Dados (LGPD) primariamente pertence à <strong className="font-semibold text-brand-ink">profissional</strong> (controladora). Nós garantimos que esses dados serão utilizados pela Nera apenas para viabilizar as confirmações de agendamento e exibir o histórico na conta do profissional. Nunca venderemos dados dos seus clientes para terceiros.
          </p>

          <h2 className="text-xl sm:text-2xl font-serif text-brand-ink font-semibold tracking-tight mt-10 pt-4 pb-2 border-b border-brand-mist/40">
            6. Compartilhamento e Integrações
          </h2>
          <p>
            Não vendemos suas informações. Compartilhamos dados apenas com provedores essenciais para o funcionamento da plataforma:
          </p>
          <ul className="space-y-3 pl-5 list-disc marker:text-brand-terracotta/50 text-brand-stone/85 my-4">
            <li><strong className="font-semibold text-brand-ink">Google Firebase:</strong> Nossa base de dados e sistema de autenticação segura.</li>
            <li><strong className="font-semibold text-brand-ink">Stripe:</strong> Onde são geridos todos os pagamentos e assinaturas de forma criptografada. Nenhum dado de cartão de crédito é armazenado na Nera.</li>
            <li><strong className="font-semibold text-brand-ink">Google Calendar:</strong> Se ativado pelo profissional, sincronizamos apenas as datas/horários dos blocos para evitar conflitos na sua vitrine.</li>
          </ul>

          <h2 className="text-xl sm:text-2xl font-serif text-brand-ink font-semibold tracking-tight mt-10 pt-4 pb-2 border-b border-brand-mist/40">
            7. Retenção e Segurança
          </h2>
          <p>
            Mantemos precauções e padrões técnicos de segurança do mercado para proteger suas informações pessoais contra perda, uso indevido, acesso não autorizado e alteração. Seu acesso é protegido mediante autenticação do Google, mantendo o ambiente da sua agenda seguro. Ao cancelar sua conta, você pode solicitar a remoção permanente do banco de dados das suas informações sensíveis.
          </p>

          <h2 className="text-xl sm:text-2xl font-serif text-brand-ink font-semibold tracking-tight mt-10 pt-4 pb-2 border-b border-brand-mist/40">
            8. Direitos do Titular (LGPD)
          </h2>
          <p>
            De acordo com a Lei Geral de Proteção de Dados do Brasil, você tem direito de solicitar o acesso, a correção e a exclusão dos seus dados pessoais que estejam sob nosso controle, bem como entender de forma transparente como estão sendo tratados. A Nera se compromete a honrar esses direitos prontamente.
          </p>
          <p className="mt-3">
            Além dos direitos previstos pela legislação aplicável, o titular dos dados poderá solicitar:
          </p>
          <ul className="space-y-3 pl-5 list-disc marker:text-brand-terracotta/50 text-brand-stone/85 my-4">
            <li>confirmação da existência de tratamento de dados;</li>
            <li>acesso aos dados pessoais armazenados;</li>
            <li>correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>portabilidade dos dados, quando aplicável;</li>
            <li>anonimização, bloqueio ou eliminação de dados tratados em desconformidade com a legislação;</li>
            <li>exclusão de dados pessoais, observadas as hipóteses legais de retenção obrigatória;</li>
            <li>informações sobre compartilhamento de dados com terceiros;</li>
            <li>revogação do consentimento, quando o tratamento depender dessa base legal.</li>
          </ul>
          <p>
            As solicitações poderão ser realizadas através do canal oficial de contato informado nesta Política de Privacidade.
          </p>

          <h2 className="text-xl sm:text-2xl font-serif text-brand-ink font-semibold tracking-tight mt-10 pt-4 pb-2 border-b border-brand-mist/40">
            9. Alterações nesta Política
          </h2>
          <p>
            Sempre que implementarmos novidades que exijam uma mudança nesta política, atualizaremos esta página. Se a mudança for significativa em relação ao uso de seus dados, notificaremos você ativamente pelo painel Nera ou por e-mail.
          </p>

          <h2 className="text-xl sm:text-2xl font-serif text-brand-ink font-semibold tracking-tight mt-10 pt-4 pb-2 border-b border-brand-mist/40">
            10. Fale Conosco
          </h2>
          <p>
            Se tiver qualquer dúvida sobre sua privacidade na Nera ou desejar exercer algum de seus direitos relativos aos dados, estamos à disposição. Solicitações relacionadas à privacidade, proteção de dados e direitos previstos na LGPD podem ser encaminhadas para o canal oficial de atendimento da Nera. Entre em contato conosco através do e-mail: <strong className="text-brand-terracotta hover:underline cursor-pointer">contato@usenera.com</strong>.
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
