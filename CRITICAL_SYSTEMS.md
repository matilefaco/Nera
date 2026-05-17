# CRITICAL SYSTEMS & PROTECTED ZONES (NERA)

Este documento mapeia os sistemas vitais da plataforma Nera e define zonas que NÃO devem ser alteradas sem auditoria técnica rigorosa. O objetivo é evitar regressões e manter a consistência do sistema.

---

## 1. ÁREAS CRÍTICAS (P0/P1)

### P0: Sistema de Slugs (Unicidade e Resolução)
*   **Source of Truth:** Coleção `slugs/{slug}`. Toda reserva de link de vitrine deve obrigatoriamente criar um documento nesta coleção.
*   **Resolução Pública:** O `PublicProfile.tsx` resolve o `uid` consultando `/slugs` primeiro. O fallback para `/users` deve detectar conflitos (múltiplos documentos com mesmo slug) e abortar ao invés de escolher um arbitrariamente.
*   **Risco Histórico:** Slugs duplicados permitindo que uma profissional acessasse a vitrine de outra.

### P0: Onboarding e Publicação (Atomicidade)
*   **Transacional:** A rota `/api/profile/save` utiliza `db.runTransaction`. Profile save, reserva de slug e flags de conclusão devem ser atômicos.
*   **Idempotência de Serviços:** Serviços são criados/atualizados via "upsert" baseado no nome normalizado. Re-publicar o onboarding com o mesmo payload não deve duplicar serviços no banco.
*   **Risco Histórico:** Serviços multiplicados (3, 6, 9...) a cada clique em "Publicar".

### P0: Stripe e Webhooks (Planos e Limites)
*   **Fonte Única:** O status do plano (`free`, `premium`, `gold`) deve ser atualizado exclusivamente via webhooks do Stripe ou lógica de proteção no backend.
*   **Proteção de Temas:** O backend deve validar o plano do usuário antes de salvar variantes de tema bloqueadas (ex: Ivory/Black em planos free).

### P1: Autenticação (Premium Flow)
*   **Admin SDK:** O registro inicial (`/api/auth/register`) usa o Admin SDK para evitar que o Firebase envie e-mails de verificação genéricos/não-brandados.
*   **Email System:** A verificação de e-mail é disparada manualmente via Resend com templates customizados (`verificationEmail.ts`).

---

## 2. REGRAS DE OURO (NUNCA ALTERAR SEM AUDITORIA)

1.  **Não use `docs[0]` sem unicidade garantida:** Sempre verifique `snapshot.empty` e `snapshot.size > 1` em queries de slug ou identificadores únicos.
2.  **Transactions para Writes Críticos:** Qualquer fluxo que envolva reserva de recurso (slug, horário, vaga) ou atualização de perfil deve usar o `runTransaction` do Admin SDK.
3.  **Idempotência no Backend:** Rotas de salvamento devem lidar bem com retentativas do frontend sem criar lixo no banco.
4.  **Preservação de Dados Manuais:** O onboarding nunca deve apagar serviços ou dados criados manualmente pela profissional em outras dashboards (ex: `source: "manual"`).

---

## 3. RISCOS HISTÓRICOS DOCUMENTADOS

*   **Safari Hang:** Firestore `getDocs` pode travar no Safari iOS se o Firebase Auth estiver em estado inconsistente ou cache de socket. Solução: Timeout forçado de 8s no frontend.
*   **Optimistic Upgrade Inseguro:** Nunca atualizar campos de plano (`plan: 'gold'`) no frontend antes da confirmação do webhook do Stripe.
*   **Prefixo de Localização:** Lógica de exibição de endereço no `PublicHero.tsx` deve tratar prefixos como "Próximo à" para evitar duplicações como "Próximo à Próximo à Praça...".

---

## 4. CHECKLIST PRÉ-MERGE / DEPLOY

- [ ] **Build & Lint:** Testar `npm run build` e `npm run lint`.
- [ ] **Slug Uniqueness:** Verificar se o fluxo permite ou impede slugs repetidos.
- [ ] **Onboarding Retry:** Clicar em "Publicar" 3 vezes seguidas e ver se os dados continuam únicos.
- [ ] **Mobile Responsiveness:** Validar visual da vitrine pública em telas pequenas.
- [ ] **Stripe CLI:** Testar webhooks localmente antes de alterar lógica de assinaturas.

---

## 5. RECOMENDAÇÕES DE ARQUITETURA FUTURA

*   **Desacoplamento do Dashboard:** O arquivo `DashboardPage.tsx` está se aproximando do limite de complexidade. Recomenda-se extrair abas em componentes isolados.
*   **Service Domain:** Centralizar toda a lógica de "upsert" e normalização de serviços em um helper do servidor.
*   **Onboarding State:** Mover estado do formulário de onboarding para um hook dedicado para facilitar manutenção sem crashes de renderização.

---
*Este documento é de caráter técnico e interno. Em caso de dúvida, consulte os logs de auditoria de Março/Maio 2024.*
