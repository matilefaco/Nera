import React from 'react';
import { Link } from 'react-router-dom';
import '../pages/LandingPage.css'; // Make sure styles are available

interface PricingGridProps {
  currentPlan?: string;
  onUpgrade?: (planId: 'essencial' | 'pro') => void;
  onManageSubscription?: () => void;
  loadingPlan?: string | null;
  isLanding?: boolean;
}

export default function PricingGrid({ currentPlan, onUpgrade, onManageSubscription, loadingPlan, isLanding }: PricingGridProps) {
  return (
    <div className="landing-page" style={{ background: 'transparent', minHeight: 'auto', padding: 0 }}>
      <div className={`plans-grid ${isLanding ? 'reveal' : ''}`} style={{ maxWidth: '1200px', margin: '0 auto', padding: isLanding ? '0 48px' : '0' }}>
        
        {/* FREE */}
        <div className="plan-card free">
          {currentPlan === 'free' && <div className="plan-badge" style={{ background: 'var(--mist)', color: 'var(--stone)' }}>Seu plano atual</div>}
          <div className="plan-tier">Gratuito</div>
          <div className="plan-price">R$&nbsp;0</div>
          <div className="plan-period">para sempre</div>
          <p className="plan-tagline">Para começar, sentir a diferença e nunca mais voltar atrás.</p>
          <ul className="plan-features">
            <li className="plan-feat"><span className="feat-bullet"></span>Perfil digital premium (foto, bio e serviços)</li>
            <li className="plan-feat"><span className="feat-bullet"></span>Até 15 agendamentos por mês</li>
            <li className="plan-feat"><span className="feat-bullet"></span>Bloqueio simples de horários</li>
            <li className="plan-feat"><span className="feat-bullet"></span>Notificações básicas por e-mail</li>
            <li className="plan-feat"><span className="feat-bullet"></span>Link direto para bio</li>
          </ul>
          {isLanding ? (
            <Link to="/register" className="btn-plan outline">Criar conta grátis</Link>
          ) : (
            <button disabled className="btn-plan outline" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
              {currentPlan === 'free' ? 'Plano Ativado' : 'Incluso'}
            </button>
          )}
        </div>

        {/* ESSENTIAL */}
        <div className="plan-card essential">
          {currentPlan === 'essencial' && <div className="plan-badge" style={{ background: 'var(--sienna)', color: 'white' }}>Seu plano atual</div>}
          <div className="plan-tier">Essencial</div>
          <div className="plan-price">R$&nbsp;49</div>
          <div className="plan-period">por mês · cancele quando quiser</div>
          <p className="plan-tagline" style={{ borderBottomColor: 'rgba(255,255,255,0.08)', paddingBottom: '16px', marginBottom: '16px' }}>
            Para quem já atende com frequência e quer parar de improvisar.
            <span style={{ display: 'block', marginTop: '6px', fontSize: '13px', opacity: 0.8, fontWeight: 400 }}>
              15 dias de teste grátis com cartão
            </span>
          </p>
          <ul className="plan-features">
            <li className="plan-feat"><span className="feat-bullet"></span>Agendamentos ilimitados</li>
            <li className="plan-feat"><span className="feat-bullet"></span>Experiência profissional por e-mail</li>
            <li className="plan-feat"><span className="feat-bullet"></span>Confirmações e lembretes automáticos por e-mail</li>
            <li className="plan-feat"><span className="feat-bullet"></span>Bloqueios recorrentes e avançados</li>
            <li className="plan-feat"><span className="feat-bullet"></span>Histórico completo de clientes</li>
          </ul>
          {isLanding ? (
            <Link to="/register?plan=essencial" className="btn-plan white-solid">Ativar teste gratuito</Link>
          ) : (
             <button 
                onClick={() => onUpgrade?.('essencial')}
                disabled={currentPlan === 'essencial' || !!loadingPlan || currentPlan === 'pro'}
                className="btn-plan white-solid"
                style={{ opacity: (currentPlan === 'essencial' || currentPlan === 'pro' || !!loadingPlan) ? 0.5 : 1 }}
              >
                {loadingPlan === 'essencial' ? 'Processando...' : currentPlan === 'essencial' ? 'Plano Ativado' : currentPlan === 'pro' ? 'Incluso no Pro' : 'Testar grátis por 15 dias'}
            </button>
          )}
        </div>

        {/* PRO */}
        <div className="plan-card pro">
          <div className="plan-badge">{currentPlan === 'pro' ? 'Seu plano atual' : 'Para quem já está no ritmo e quer o melhor'}</div>
          <div className="plan-tier">Plano Pro</div>
          <div className="plan-price">R$&nbsp;89</div>
          <div className="plan-period">por mês · agenda, relacionamento e presença num só lugar</div>
          <p className="plan-tagline">&nbsp;</p>
          <ul className="plan-features">
            <li className="plan-feat highlight"><span className="feat-bullet"></span>Tudo do Essencial + Notificações WhatsApp</li>
            <li className="plan-feat"><span className="feat-bullet"></span>Lista de espera inteligente para preencher horários</li>
            <li className="plan-feat"><span className="feat-bullet"></span>Cupons de desconto e fidelidade</li>
            <li className="plan-feat"><span className="feat-bullet"></span>Relatório mensal de performance</li>
            <li className="plan-feat"><span className="feat-bullet"></span>Link de indicação premiado</li>
            <li className="plan-feat"><span className="feat-bullet"></span>Suporte prioritário</li>
          </ul>
          {isLanding ? (
            <Link to="/register?plan=pro" className="btn-plan terra-solid">Começar como Pro</Link>
          ) : (
            <button 
              onClick={(e) => {
                e.preventDefault();
                const planType = currentPlan?.toLowerCase();
                if (planType === 'essencial' && onUpgrade) {
                  onUpgrade('pro');
                } else if (onUpgrade) {
                  onUpgrade('pro');
                }
              }}
              disabled={currentPlan === 'pro' || !!loadingPlan}
              className="btn-plan terra-solid"
              style={{ opacity: (currentPlan === 'pro' || !!loadingPlan) ? 0.5 : 1 }}
            >
              {loadingPlan === 'pro' ? 'Processando...' : currentPlan === 'pro' ? 'Plano Ativado' : currentPlan === 'essencial' ? 'Evoluir para Pro' : 'Assinar Pro'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
