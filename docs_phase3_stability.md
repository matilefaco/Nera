# FASE 3 — Testes e Estabilidade

## Smoke test manual (fluxos críticos)
1. **Publicar perfil**
   - Entrar com conta profissional.
   - Preencher onboarding/perfil com `slug` válido.
   - Publicar e confirmar resposta de sucesso.
2. **Abrir `/p/:slug`**
   - Abrir `https://nera.app/p/<slug>`.
   - Confirmar que perfil e serviços carregam.
3. **Criar booking**
   - Selecionar serviço, data/hora.
   - Preencher nome e WhatsApp.
   - Confirmar criação sem erro.
4. **Ver booking no dashboard**
   - Voltar à conta profissional.
   - Abrir Dashboard/Agenda e validar booking recém-criado.

## Checklist de produção
- [ ] Variáveis de ambiente configuradas (`FIREBASE_*`, `RESEND_API_KEY`, `APP_URL`, etc.).
- [ ] Firestore default database ativo e acessível.
- [ ] Firestore rules deployadas no ambiente alvo.
- [ ] `npm run build` executa sem erro.
- [ ] Fluxo de booking validado ponta a ponta.
- [ ] Fluxo de publicação de perfil validado ponta a ponta.

## Validações adicionadas
- `validateProfilePayload` exige `uid` e `profileData.slug`.
- `validateBookingPayload` exige `professionalId`, `serviceId`, `clientName`, `clientWhatsapp`, `date`, `time`.
- Sanitização profunda via `sanitizeDeep` antes de persistência.
- Proteção `hasUndefinedDeep` para evitar salvar `undefined` em payload crítico.
- Logs estruturados `[CRITICAL_ROUTE]` para sucesso/falha em publicação de perfil e criação de booking, com redaction de IDs.
