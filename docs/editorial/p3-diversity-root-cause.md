# NERA — INVESTIGAÇÃO P3 — CAUSAS RAIZ DA FALTA DE DIVERSIDADE EDITORIAL

**Data:** 30 de Maio de 2026

## OBJETIVO
Investigar a engenharia de prompt atual (`analyticsRoutes.ts`) para descobrir exatamente quis instruções e regras geraram o comportamento robótico documentado no relatório P2 (com 99% das biografias iteradas iniciando com "Avalio", contaminações com "fio" e repetição na estrutura das Headlines).

Abaixo, detalhamos a autópsia das instruções repassadas à IA que geram esses subprodutos estruturais não intencionais.

---

## SEÇÃO 1 — REGRAS QUE AJUDAM
Essas regras corrigiram dores antigas com êxito e não são as maiores causadoras da cópia estrutural.

* **Regra Anti-Currículo e Anti-Idade:** `NUNCA tente provar competência ou elencar cursos... É ESTRITAMENTE PROIBIDO MENCIONAR O NÚMERO DE ANOS DE EXPERIÊNCIA...`
  * O LLaMA-3.1 realmente compreendeu e obedeceu. Removeu a mentalidade LinkedIn. O problema formou-se no vácuo de como iniciar.
* **BioContext injection:** O uso das informações primárias da pessoa para quebrar as "alucinações promocionais".

## SEÇÃO 2 — REGRAS NEUTRAS
Essas peças do prompt não afetam ativamente o problema (e em tese deveriam funcionar bem, mas foram invalidadas).

* **A Família Editorial (Ex: Minimalismo, Identidade, etc):** O conceito teórico era bom, mas como a IA é forçada a "iniciar a ação" e "avaliar/preparar", a estrutura da família (vocabulário) foi completamente subalternizada às Regras Específicas Diretas.
* **Repertório Técnico:** Usado apenas para dar substância, não causou os vícios estruturais em si.

## SEÇÃO 3 — REGRAS SUSPEITAS
Essas regras fecham o cerco criativo e induzem a repetitividade leve.

* **A Lista de Inícios Proibidos:** `- Inícios de frase proibidos (NÃO ARRANQUE ASSIM): "Eu trabalho", "Trabalho com", "Eu sou", "Sou", "Eu, Ana", "Meu foco é", "Minha prioridade é", "A minha prioridade"`
  * **Análise:** Tenta corrigir aberturas fracas. O efeito colateral é que as opções naturais de construção do idioma somem. A IA precisa encontrar uma brecha segura — e se apoia 100% no verbo no presente indicativo que é dado de exemplo na regra logo em seguida.
* **A Indução da Temática Processual:** `Fale do seu processo de trabalho real. Valorize higiene, avaliação, preparo físico da técnica, ferramentas limpas e limite técnico honesto que se aplique À SUA ESPECIALIDADE...`
  * **Análise:** Tenta curar a linguagem marqueteira e "beauty fairy-tale" substituindo por processo real. 
  * **Efeito Colateral:** Faz com que 100% das profisssionais pareçam engenheiras de clínica e repitam "materiais descartáveis", "higiene", "antes do procedimento".

## SEÇÃO 4 — REGRAS ALTAMENTE SUSPEITAS (AS CAUSADORAS REAIS)
Estes são os "gatilhos letais" que quebraram a geração e criaram zumbis linguísticos limitando as escolhas.

* **O Gatilho do "Avalio...":** 
  `2. A bio deve ter ritmo natural de uma fala e DEVE começar diretamente pelo processo, usando verbo de ação e ocultando o pronome (ex: "Avalio...", "Preparo...", "Observo...", "Respeito...", "Organizo...", "Oriento...", "Ajusto...", "Escolho...", "Verifico...").`
  * **Comportamento que corrige:** O fim dos vícios LinkedIn.
  * **Efeito Colateral Fatal:** A palavra "DEVE" somada a "começar diretamente... usando verbo de ação" atua de forma extremista na árvore de decisão do *LLaMA-3.1*. E o pior: a IA utiliza *lazy reasoning* (razão preguiçosa), pegando exatamente o **primeiro verbo oferecido no bloco de exemplo** ("Avalio...") em 99% das vezes. A palavra de número 2 ("Preparo...") aparece no corpo da bio logo depois. 
* **O Início da Contaminação do ‘Fio’ e Headline Clonada:**
  Exemplos de direção para headline:
  `- Cílios leves para quem nunca usou extensão`
  `- Sobrancelhas sem efeito marcado`
  `- Unhas discretas para trabalhar sem pensar nelas`
  `- Corte que respeita a textura natural do seu fio` *(O PACIENTE ZERO DA CONTAMINAÇÃO)*
  `- Massagem para quem vive tenso no dia a dia`
  * **Comportamento que corrige:** Parar de chamar tudo de "Design de X Clássico".
  * **Efeito Colateral Fatal:**
    1. A IA incorporou "respeitar a textura natural do fio" como sinônimo geral de "bom atendimento biológico", colando a expressão até mesmo no repertório de manicures e depiladoras.
    2. Quase todos os exemplos fornecidos utilizam o sintagma **[Benefício Visual Físico] + "para" + [Situação de Dor]**. A headline de resultados da geração obedeceu fielmente à métrica com 100% de obediência.

---

## SEÇÃO 5 — RANKING DAS MAIORES CAUSAS DA FALTA DE DIVERSIDADE

1. **A injeção do imperativo sintático exclusivo:** `DEVE começar diretamente pelo processo`. (Bloqueia todas as outras aberturas possíveis do português).
2. **O primeiro item na lista de exemplos literais de verbos:** `(ex: "Avalio...", "Preparo...")`. (Ancoragem absoluta do Llama no "Avalio").
3. **O Paciente Zero do "Fio":** Ao oferecer `Corte que respeita a textura natural do seu fio` como exemplo genérico de headline positiva e recomendada, a IA assimilou isso como padrão-prêmio.
4. **O excesso de regras proibitivas de início:** (Eu trabalho, Eu sou, Meu foco é, etc). O LLM se fecha num "corredor sintático" de uma via.
5. **A instrução de valorizar processo obrigatório:** `Valorize higiene, avaliação, preparo físico da técnica, ferramentas limpas`. Obrigou manicures a repetirem pautas processuais de mesa cirúrgica em bios que poderiam ser leves.
6. **Alinhamento e Estrutura dos Exemplos (Headlines):** Todos possuem estrutura idêntica, induzindo um clone sintático da preposição `para` ("Substantivo PARA X").

---

## SEÇÃO 6 — MENOR ALTERAÇÃO POSSÍVEL PARA RECUPERAR DIVERSIDADE

A fim de não reabrir o espectro do *LinkedIn Corporativo* ou do *Marketing dos Sonhos*, sugere-se uma **abordagem cirúrgica de redução e flexibilização**, não adicionando nada novo e em vez disso afrouxando cordas.

**Ações Pontuais de Otimização:**
1. **Destruir o Paradigma Imperativo de Início:** 
   * Remover: `DEVE começar diretamente pelo processo, usando verbo de ação... ex: "Avalio..."`.
   * Substituir por: `A bio deve soar natural. Você PODE iniciá-la falando da cliente ("Muitas clientes me procuram...", "Quem senta na minha cadeira..."), OU do seu propósito técnico, OU do resultado, OU direto pela especialidade. VÁRIE AS ABERTURAS.`
2. **Incineração do Paciente Zero:** 
   * Deletar IMEDIATAMENTE a headline de exemplo `Corte que respeita a textura natural do seu fio`. Substitua por outro modelo sem menção a anatomia específica, ex.: `Trancista focada na durabilidade e raízes protegidas`.
3. **Diversificar os exemplos estruturais de Headline:**
   * Garantir que as linhas de Exibição de Headline não repitam três vezes seguida a palavra `para`.
4. **Afrouxar o rigor do "Kit Médico":**
   * Ajustar a linha: `Valorize higiene, avaliação, preparo físico...` 
   * Para: `Se for relevante para a especialidade, traga pequenos detalhes práticos do seu preparo, avaliação ou cuidado, mas sem soar clínico demais ou robótico.`

Com a mera remoção dessas quatro correntes literais, o LLaMA terá janela estocástica suficiente para utilizar a sua base probabilística e variar a geração textual de forma natural, sem ressuscitar as "muletas marqueteiras" (que ainda continuariam firmemente bloqueadas nas restrições originais de palavras proibidas).
