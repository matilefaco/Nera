# Nera - Ambiente de Demonstração (Demo Environment)

Este documento descreve a arquitetura, o funcionamento, as garantias de segurança e o gerenciamento do **Ambiente de Demonstração Híbrido** da Nera.

---

## 1. Arquitetura do Ambiente Demo

O Ambiente Demo foi implementado seguindo a abordagem de **Conta Demo Real + Seed Determinístico + Rotina de Atualização de Datas**. 

Esta abordagem apresenta as seguintes vantagens:
- **Sem Interceptação Client-Side**: Não sobrecarrega a lógica do frontend nem introduz complexidade em hooks.
- **Isolamento de Dados**: Utiliza marcadores estritos e identificadores determinísticos para garantir que dados reais de clientes e profissionais nunca sejam alterados.
- **Fidelidade de Fluxo**: Como a conta e os dados existem de fato no Firestore, todos os endpoints do backend (faturamento, relatórios, vitrine pública, etc.) funcionam perfeitamente e retornam métricas extremamente realistas.

---

## 2. Personagem e Negócio

- **Profissional**: Isabella Rocha
- **Negócio**: Studio Aurora Beauty
- **Especialidade**: Nail Designer Premium
- **Slug Público**: `/studio-aurora-demo`
- **Email de Acesso**: `isabella.rocha@nera.com.br`
- **Senha de Acesso**: `NeraDemo2026!`

---

## 3. Comandos de Gerenciamento (NPM Scripts)

Dois novos comandos foram adicionados ao `package.json` para facilitar o gerenciamento pelo time de marketing ou engenharia:

### A) Popular / Resetar o Ambiente Demo
Este comando executa um reset completo e determinístico do perfil demo. Ele limpa todas as informações anteriores do perfil `studio-aurora` (e apenas dele) e reconstrói dados ricos calculando datas dinamicamente com base no dia atual.

```bash
npm run demo:seed
```

### B) Atualizar/Avançar as Datas da Agenda
Este comando atualiza as datas dos agendamentos e bloqueios de agenda fictícios de forma a manter a agenda da Isabella Rocha sempre "viva" e movimentada em relação ao dia atual, ideal para ser usado em crons diárias ou semanalmente de forma manual.

```bash
npm run demo:refresh
```

---

## 4. Estrutura de Dados Criada (Firestore)

Ao executar o seed, as seguintes coleções são populadas:

1. **`users`**: Cria o perfil profissional completo da Isabella, incluindo endereço premium nos Jardins (São Paulo), horários de funcionamento, preferências de temas (Rose) e link para redes sociais.
2. **`slugs`**: Reserva o slug `studio-aurora-demo` ligando-o deterministicamente ao UID da Isabella.
3. **`services`**: Cria 4 serviços premium com preços e durações coerentes (Alongamento em Gel, Manutenção, Spa de Mãos, Pé & Mão Clássico).
4. **`portfolio` (subcoleção)**: Adiciona 3 fotos de altíssima qualidade vinculadas a serviços, prontas para exibição na Vitrine.
5. **`client_summaries`**: Cria 5 clientes recorrentes (Mariana, Camila, Beatriz, Juliana, Fernanda) com históricos de gastos, número de agendamentos e classificação por segmentos de fidelidade (Diamond, Gold, etc.).
6. **`client_notes` (subcoleção)**: Armazena notas personalizadas de atendimento para cada cliente, simulando o prontuário profissional.
7. **`appointments`**: Cria **43 agendamentos** realistas:
   - **30 agendamentos passados concluídos** distribuídos uniformemente nos últimos 30 dias (garantindo gráficos de faturamento ricos e ticket médio realista no Dashboard).
   - **13 agendamentos futuros** (hoje, amanhã e próximas semanas) com variados status (*completed*, *confirmed*, *pending*, *cancelled_by_client*).
8. **`reviews` & `review_stats`**: Popula o sistema com 3 avaliações 5 estrelas altamente realistas e calcula a média geral e as tags mais citadas no perfil público.
9. **`blocked_schedules`**: Insere bloqueios de agenda simulando compromissos pessoais e almoço.

---

## 5. Garantias de Segurança e Proteção de Dados de Produção

Para blindar o banco de dados contra qualquer alteração acidental de contas reais, o sistema implementa as seguintes regras fundamentais:

- **Marcadores Explícitos**: Todos os documentos gerados pelo ambiente demo possuem os campos:
  - `isDemo: true`
  - `demoProfile: "studio-aurora"`
  - `demoSeedVersion: "v1"`
- **Cleanup Controlado**: A rotina de exclusão e reset do seed utiliza cláusulas estritas de `where` com `isDemo === true` e somente afeta documentos associados ao ID `demo-isabella-rocha-uid-v1`.
- **Prevenção de Colisão de Slugs**: O slug `/studio-aurora-demo` possui um sufixo explícito para nunca colidir com eventuais profissionais de nome similar.

---

## 6. Próximos Passos para Captura de Conteúdo e Marketing

O ambiente está 100% pronto para uso promocional. Os caminhos recomendados de acesso são:

1. **Vitrine Pública (Link público)**:
   Acesse diretamente `https://<dominio>/studio-aurora-demo` para visualizar a vitrine pública integrada com os serviços premium, portfólio rico em fotos e as avaliações com tags.
2. **Painel / Dashboard Privado**:
   Realize o login com o e-mail `isabella.rocha@nera.com.br` e a senha `NeraDemo2026!` para acessar e gravar vídeos ou tirar screenshots do painel financeiro rico em dados, da lista de clientes detalhada com segmentações, prontuários de notas e a agenda dinâmica e movimentada.
