import dotenv from "dotenv";
dotenv.config();

import { callNvidiaAI } from "../server/utils.js";
import fs from 'fs';

function getPrompt(profile) {
  const { name, specialty, yearsExperience, serviceStyle, differentials, bioContext } = profile;
  
  const lowerSpec = (specialty || '').toLowerCase();
  let exampleHeadline = '';
  let repertoire = '';
  let repertoireSafe = '';
  let repertoireSpecific = '';
  
  type EditorialFamily = { name: string, favored: string, avoid: string };
  let families: Array<EditorialFamily> = [];
  if (lowerSpec.includes('nail') || lowerSpec.includes('fibra') || lowerSpec.includes('manicure') || lowerSpec.includes('unha')) {
    families = [
      { name: 'praticidade', favored: 'rotina, praticidade, manutenção, dia a dia, funcional', avoid: 'criatividade, nail art, precisão, detalhes' },
      { name: 'criatividade', favored: 'expressão, personalidade, combinações, estilo, visual', avoid: 'rotina, manutenção, praticidade' },
      { name: 'minimalismo', favored: 'leveza, discrição, simplicidade, visual limpo', avoid: 'nail art, criatividade, detalhes, precisão' },
      { name: 'durabilidade', favored: 'resistência, estrutura, longa duração, manutenção reduzida', avoid: 'criatividade, minimalismo' },
      { name: 'detalhes', favored: 'acabamento, desenho, observação, simetria', avoid: 'praticidade, rotina, durabilidade' }
    ];
  } else if (lowerSpec.includes('lash') || lowerSpec.includes('cílios') || lowerSpec.includes('cilios')) {
    families = [
      { name: 'olhar', favored: 'expressão, magnetismo, destaque, despertar, olhar marcante', avoid: 'harmonia, conforto, simetria, leveza excessiva' },
      { name: 'harmonia', favored: 'equilíbrio, naturalidade, formato do rosto, visagismo', avoid: 'olhar exagerado, conforto extremo, simetria rígida' },
      { name: 'conforto', favored: 'leveza, bem-estar, peso zero, rotina, conforto no uso', avoid: 'olhar denso, harmonia complexa, simetria, volume extremo' },
      { name: 'simetria vascular', favored: 'precisão, alinhamento, exatidão, técnica impecável', avoid: 'olhar abstrato, harmonia livre, conforto descompromissado' },
      { name: 'moldura', favored: 'realce, contorno, estrutura, definição do olhar', avoid: 'olhar isolado, conforto puro, simetria matemática' }
    ];
  } else if (lowerSpec.includes('trancista') || lowerSpec.includes('trança') || lowerSpec.includes('tranca')) {
    families = [
      { name: 'expressão', favored: 'arte, estilo, personalidade, criatividade, visual único', avoid: 'saúde do fio, alinhamento, prevenção, discrição' },
      { name: 'identidade', favored: 'raízes, pertencimento, essência, força, autoria', avoid: 'expressão livre, alinhamento técnico, cultura acadêmica' },
      { name: 'saúde do fio', favored: 'cuidado, preservação, couro cabeludo, proteção capilar', avoid: 'expressão artística, identidade, cultura, volume extremo' },
      { name: 'cultura', favored: 'tradição, história, legado, ancestralidade', avoid: 'saúde do fio, alinhamento milimétrico' },
      { name: 'alinhamento protetor', favored: 'técnica, precisão, durabilidade, estrutura, trança firme', avoid: 'expressão solta, identidade, cultura abstrata' }
    ];
  } else if (lowerSpec.includes('podolog') || lowerSpec.includes('podólog')) {
    families = [
      { name: 'conforto silencioso', favored: 'alívio, bem-estar, descanso, leveza para os pés', avoid: 'prevenção, pisada, estrutura vascular' },
      { name: 'prevenção', favored: 'cuidado contínuo, atenção, antecipação, acompanhamento', avoid: 'conforto imediato, pisada, mobilidade' },
      { name: 'pisada livre', favored: 'caminhada, uso diário, sem dor, soltura, passos leves', avoid: 'prevenção médica, saúde estrutural' },
      { name: 'mobilidade cotidiana', favored: 'rotina, trabalho, movimento, dia a dia confortável', avoid: 'conforto de spa, prevenção técnica' },
      { name: 'saúde estrutural', favored: 'anatomia, técnica apurada, recuperação, cuidado profundo', avoid: 'conforto superficial, pisada estética' }
    ];
  } else if (lowerSpec.includes('micro') || lowerSpec.includes('micropigmentadora')) {
    families = [
      { name: 'simetria natural', favored: 'equilíbrio, naturalidade, formato, harmonia, rosto', avoid: 'precisão matemática, contraste, desenho marcante' },
      { name: 'precisão técnica', favored: 'exatidão, técnica, durabilidade, fio a fio exato', avoid: 'simetria natural solta, contraste suave' },
      { name: 'contraste suave', favored: 'leveza, sombra, degradê, aspecto maquiado leve', avoid: 'precisão extrema, observação rigorosa, desenho rígido' },
      { name: 'desenho anatômico', favored: 'estrutura, visagismo, medidas, formato ideal, mapeamento', avoid: 'contraste suave, simetria natural intuitiva' },
      { name: 'observação de traços', favored: 'individualidade, personalização, leitura do rosto', avoid: 'precisão técnica padrão, contraste suave genérico' }
    ];
  } else if (lowerSpec.includes('estetic') || lowerSpec.includes('pele') || lowerSpec.includes('facial')) {
    families = [
      { name: 'rotina', favored: 'dia a dia, skincare, constância, praticidade, hábitos', avoid: 'textura, barreira, vitalidade milagrosa' },
      { name: 'textura saudável', favored: 'toque, uniformidade, viço, maciez, pele suave', avoid: 'rotina complexa, barreira profunda, bem-estar' },
      { name: 'barreira cutânea', favored: 'proteção, equilíbrio, saúde da pele, hidratação avançada', avoid: 'rotina simples, textura focada, vitalidade instantânea' },
      { name: 'bem-estar diário', favored: 'relaxamento, autocuidado, momento seu, pausa', avoid: 'textura focada, barreira cutânea rígida' },
      { name: 'vitalidade', favored: 'luminosidade, renovação, energia, rosto descansado', avoid: 'rotina rígida, barreira protetora, relaxamento passivo' }
    ];
  } else {
    families = [
      { name: 'bem-estar diário', favored: 'conforto, rotina, alívio, leveza, momentos tranquilos', avoid: 'técnica avançada, precisão extrema, foco estético' },
      { name: 'auto-cuidado natural', favored: 'essência, naturalidade, calma, tempo de qualidade', avoid: 'resultados imediatos, performance, detalhes exatos' },
      { name: 'tranquilidade', favored: 'paz, pausa, relaxamento do corpo, silêncio interior', avoid: 'rotina dinâmica, correção estética' },
      { name: 'rotina', favored: 'dia a dia, hábitos consistentes, manutenção, constância', avoid: 'tranquilidade de spa, naturalidade extrema' },
      { name: 'conforto', favored: 'acolhimento absoluto, cuidado sem dor, alívio diário', avoid: 'performance intensa, técnica avançada, simetria' }
    ];
  }
  const chosenFamily = families[Math.floor(Math.random() * families.length)];
  
  if (lowerSpec.includes('maqui')) {
    exampleHeadline = '- Maquiadora: "Make para noivas, formandas e madrinhas"';
    repertoire = "maquiagem social, noivas, madrinhas, formandas, maquiagem fotográfica, pele blindada, colorimetria, visagismo, maquiagem artística, airbrush, delineado esfumado, cut crease";
  } else if (lowerSpec.includes('estetic') || lowerSpec.includes('pele') || lowerSpec.includes('facial')) {
    exampleHeadline = '- Esteticista: "Limpeza de pele e protocolos faciais avançados"';
    repertoire = "limpeza de pele, peeling, microagulhamento, radiofrequência, LED terapia, protocolos faciais, hidratação facial, tratamento para acne, rejuvenescimento, revitalização, massagem facial, drenagem facial";
  } else if (lowerSpec.includes('lash') || lowerSpec.includes('cílios') || lowerSpec.includes('cilios')) {
    exampleHeadline = '- Lash Designer: "Fio a fio, volume russo e lifting"';
    repertoire = "fio a fio, volume brasileiro, volume russo, volume híbrido, mega volume, wet effect, cat eye, fox eye, lash lifting, lash botox, mapping, manutenção";
  } else if (lowerSpec.includes('sobrancelha')) {
    exampleHeadline = '- Sobrancelhas: "Design, henna e laminação"';
    repertoire = "henna, brow lamination, design estratégico, visagismo, alinhamento facial, correção de assimetria, fio a fio, coloração, tintura de sobrancelhas, epilação egípcia, mapeamento facial";
  } else if (lowerSpec.includes('cabel') || lowerSpec.includes('hair')) {
    exampleHeadline = '- Cabeleireira: "Corte, cor e tratamentos capilares"';
    repertoire = "corte feminino, corte bordado, cronograma capilar, reconstrução, nutrição, hidratação, balayage, morena iluminada, platinado, colorimetria, finalização de cachos, progressiva, botox capilar, mechas";
  } else if (lowerSpec.includes('bronze')) {
    exampleHeadline = '- Bronzeamento: "Bronze natural e marquinha perfeita"';
    repertoire = "bronzeamento em fita, marquinha personalizada, hidratação pré sessão, hidratação pós sessão, bronze natural, uniformização, bronze gelado, banho de lua, esfoliação";
  } else if (lowerSpec.includes('trancista') || lowerSpec.includes('trança') || lowerSpec.includes('tranca')) {
    exampleHeadline = '- Trancista: "Especialista em tranças afro e penteados protetores"';
    repertoireSafe = "tranças afro, penteados protetores, estilos de trança, cuidados com cabelo natural";
    repertoireSpecific = "box braids, twist, fulani, crochet braids, nagô";
  } else if (lowerSpec.includes('micropigmentadora') || lowerSpec.includes('micropigmentação') || lowerSpec.includes('micro')) {
    exampleHeadline = '- Micropigmentação: "Micropigmentação labial e de sobrancelhas"';
    repertoire = "fio a fio, shadow, ombré brows, nano brows, micropigmentação labial, neutralização labial, despigmentação, revitalização, delineado definitivo, microblanding";
  } else if (lowerSpec.includes('podolog') || lowerSpec.includes('podólog')) {
    exampleHeadline = '- Podologia: "Tratamento especializado e saúde dos pés"';
    repertoireSafe = "saúde dos pés, cuidados preventivos, atendimento especializado, bem-estar dos pés";
    repertoireSpecific = "órteses, unhas encravadas, fissuras, micoses, corte técnico";
  } else if (lowerSpec.includes('masso') || lowerSpec.includes('massagem')) {
    exampleHeadline = '- Massoterapeuta: "Massagem relaxante, drenagem e liberação miofascial"';
    repertoire = "drenagem linfática, relaxante, modeladora, miofascial, pedras quentes, shiatsu, reflexologia, ventosaterapia, massagem terapêutica, alívio de dor";
  } else if (lowerSpec.includes('terapeuta capilar') || lowerSpec.includes('terapia capilar')) {
    exampleHeadline = '- Terapeuta Capilar: "Tratamento de queda, caspa e saúde do couro cabeludo"';
    repertoire = "análise capilar, queda, oleosidade, couro cabeludo, fototerapia, recuperação capilar, detox capilar, argiloterapia, alta frequência, alopecia, dermatite seborreica, tricologia";
  } else if (lowerSpec.includes('nail') || lowerSpec.includes('fibra')) {
    exampleHeadline = '- Nail Designer: "Especialista em fibra de vidro e nail art"';
    repertoire = "fibra de vidro, gel, molde f1, encapsulamento, nail art, blindagem, manutenção, banho de gel, esmaltação em gel, francesinha reversa, baby boomer";
  } else if (lowerSpec.includes('manicure') || lowerSpec.includes('unha') || lowerSpec.includes('esmaltação')) {
    exampleHeadline = '- Manicure: "Esmaltação em gel e unhas naturais"';
    repertoire = "esmaltação em gel, banho de gel, blindagem, encapsulada, fibra de vidro, cutilagem russa, nail art, spa dos pés, manutenção, cutilagem contínua, unhas naturais";
  } else if (lowerSpec.includes('labial') || lowerSpec.includes('lábio') || lowerSpec.includes('labio')) {
    exampleHeadline = '- Designer Labial: "Revitalização e design de lábios"';
    repertoire = "revitalização labial, neutralização labial, micropigmentação labial, efeito batom, aquarela lips, hidra gloss, design de lábios";
  } else if (lowerSpec.includes('depiladora') || lowerSpec.includes('depilação')) {
    exampleHeadline = '- Depiladora: "Depilação a laser, cera e método egípcio"';
    repertoire = "cera quente, cera fria, método egípcio (linha), depilação facial, depilação corporal, pele sensível, depilação a laser, luz pulsada, epilação";
  } else if (lowerSpec.includes('piercing') || lowerSpec.includes('body piercer')) {
    exampleHeadline = '- Body Piercer: "Perfurações seguras e joias em titânio"';
    repertoire = "perfurações seguras, joias em titânio, aço cirúrgico, biossegurança, perfuração auricular, perfuração corporal, microdermal, surface, downsize, anodização";
  } else {
    exampleHeadline = '- Profissional: "Atendimento especializado em beleza e bem-estar"';
  }

  let repertoireSection = '';
  
  if (repertoireSafe && repertoireSpecific) {
    repertoireSection = `\nREPERTÓRIO TÉCNICO DA PROFISSÃO (DIVIDIDO EM 2 NÍVEIS):

1. REPERTÓRIO SEGURO (USO LIVRE):
Pode ser usado livremente para descrever a profissão, pois são descrições amplas da área.
Termos seguros: ${repertoireSafe}

2. REPERTÓRIO ESPECÍFICO (USO RESTRITO E BLOQUEADO):
SÃO TÉCNICAS E PROCEDIMENTOS ESPECÍFICOS. Você é ESTRITAMENTE PROIBIDA de afirmar que a profissional executa qualquer técnica abaixo se não houver confirmação explícita nos DADOS DA PROFISSIONAL.
Apenas cite essas técnicas se a usuária as forneceu.
Técnicas estritas (proibido inventar): ${repertoireSpecific}\n`;
  } else if (repertoire) {
    repertoireSection = `\nREPERTÓRIO TÉCNICO DA PROFISSÃO (CONTEXTO GERAL):
O repertório técnico serve apenas para compreender o universo daquela profissão.
O repertório NÃO representa serviços confirmados.
Você é ESTRITAMENTE PROIBIDA de afirmar que a profissional executa uma técnica específica apenas porque ela existe no repertório.
Uma técnica só pode ser apresentada como serviço realizado quando ela tiver sido explicitamente informada pela profissional nos DADOS DA PROFISSIONAL.
Quando não houver informação suficiente, utilize descrições amplas da área de atuação.

Técnicas da área para contexto: ${repertoire}\n`;
  }


  return `Você é uma profissional real da área de beleza e bem-estar no Brasil, descrevendo seu próprio trabalho para clientes no seu perfil ou Instagram.
Seu objetivo é gerar uma Frase Principal (headline) curta e uma Mini Bio (bio) baseada EXCLUSIVAMENTE nos dados abaixo.

A linguagem deve soar HUMANA, NATURAL, DISCRETA e PROFISSIONAL.
NUNCA escreva como um copywriter publicitário. Fale com naturalidade, segurança e modéstia, como se explicasse o que você faz para uma nova cliente.

DADOS DA PROFISSIONAL:
- Nome: ${name || 'A profissional'}
- Profissão real/Especialidade: ${specialty || 'Beleza e Bem-estar'}
- Perfil de Maturidade: ${yearsExperience ? (parseInt(yearsExperience as string) >= 4 ? 'Profissional experiente, madura e segura' : 'Profissional dedicada e atualizada') : 'Profissional dedicada'}
- Estilo: ${Array.isArray(serviceStyle) ? serviceStyle.join(', ') : (serviceStyle || 'Cuidadoso')}
- Diferenciais focais: ${Array.isArray(differentials) ? differentials.join(', ') : (differentials || 'Bom atendimento')}

CONTEXTO ADICIONAL INFORMADO PELA PROFISSIONAL (FONTE PRINCIPAL DE DIREÇÃO):
${bioContext ? '"' + bioContext + '"\n\nMÁXIMA PRIORIDADE - ESTE CONTEXTO É O EIXO PRINCIPAL:\n1. Ele é a principal fonte real desta profissional.\n2. Extraia temas centrais, perfil de cliente, preferências técnicas ou rotina (ex: problema comum, rotina da cliente, situação real).\n3. Você DEVE garantir que a HEADLINE e a BIO reflitam a SITUAÇÃO e o CLIMA desse contexto. \n4. É ESTRITAMENTE PROIBIDO copiar as palavras do contexto literalmente ("Recortar e colar"). Você deve INTERPRETAR.\n5. Em caso de conflito, o contexto sobrescreve a Família Editorial listada abaixo.' : 'Não informado'}
${repertoireSection}
INSTRUÇÕES EDITORIAIS CRÍTICAS PARA "CONVERSA HUMANA" (LEIA COM MÁXIMA ATENÇÃO):
O tom exigido é uma conversa real: transmita confiança com naturalidade e limites honestos.
Evite completamente linguagem de promessa, "autoestima genérica", "soberania", "experiência única", "beleza dos sonhos". A comunicação deve ser muito normal, sóbria e modesta.

A REGRA DOS DIFERENCIAIS (ATENÇÃO!):
É ESTRITAMENTE PROIBIDO colar literalmente as expressões contidas nos "Diferenciais focais" e "Estilo". 
A IA deve usar os diferenciais para INFLUENCIAR O TOM indiretamente. Exemplo: se o diferencial for "Pontualidade", sugira consistência de agenda ou respeito ao tempo da cliente de forma orgânica, MAS É ESTRITAMENTE PROIBIDO usar palavras como "pontualidade" ou "pontual" literalmente, ou colar atributos de forma mecânica.

PALAVRAS E EXPRESSÕES ESTRITAMENTE PROIBIDAS (NÃO USE NUNCA):
- Muletas afetivas e genéricas (PROIBIDAS): "cuidado e atenção", "atenção e cuidado", "cuidado e dedicação", "dedicação e cuidado", "atendimento cuidadoso", "com carinho", "prioridade é", "meu foco é", "valorizo a pontualidade", "priorizo a pontualidade"
- Estruturas de Currículo / LinkedIn (PROIBIDAS): "profissional", "especializada", "especialista em", "alta durabilidade", "segura", "duradoura", "com qualidade", "alta qualidade", "com amor e dedicação", "com técnicas modernas", "experiência em", "sucesso em"
- Marketing/coach/luxo: "premium", "luxo", "exclusiva", "excelência", "experiência única", "autoestima", "transformar vidas", "realçar sua beleza", "revelar sua melhor versão", "soberana", "atendimento diferenciado", "resultados extraordinários"
- Cafonas/Artificiais/Emocionais demais: "cuido das suas unhas como cuido das minhas", "quando você sair, vai querer voltar", "arte em cada milímetro", "olhar que hipnotiza", "beleza que transforma"
- Genéricos colados: "Trabalho com cuidado e dedicação", "Meu foco é", "Rápida e eficiente" (PROIBIDO: Não repita "rápida e eficiente" ou "rápido e")

DIRETRIZES DE ESTILO PARA HEADLINE (FOCO EM SITUAÇÃO REAL, MENOS RÓTULO):
1. A headline deve ser CURTA e DIRETA. A headline pode ser uma frase curta de benefício, uma situação real da cliente, uma promessa prática, um contraste ou uma descrição simples do resultado. Não use sempre a estrutura 'X para Y'.
2. A headline NÃO DEVE parecer uma categoria de marketplace (PROIBIDO: "Design de X com Y", "Especialista em X").
3. Headline curta, concreta, que mostra o seu verdadeiro foco. 
Exemplos de direção (NÃO COPIE E NÃO TENTE IMITAR A ESTRUTURA):
- Cílios com leveza absoluta
- Sobrancelhas sem efeito marcado
- Unhas discretas e rotina descomplicada
- Tranças e raízes protegidas
- Massagem e descompressão muscular
Exemplos RUINS (PROIBIDOS: rótulos, robótica, currículo):
- "Manicure rápida e eficiente"
- "Design de cílios com volume"
- "Massoterapeuta especializada"
- "Lash designer com naturalidade"

FAMÍLIA EDITORIAL SELECIONADA: ${chosenFamily.name.toUpperCase()}
- VOCABULÁRIO E TEMAS FAVORECIDOS: ${chosenFamily.favored}
- VOCABULÁRIO E TEMAS ESTRITAMENTE PROIBIDOS: ${chosenFamily.avoid}

DIRETRIZES DE DIVERSIDADE EDITORIAL (MUITO IMPORTANTE PARA EVITAR REPETIÇÃO):
Evite os padrões que causam homogeneização. A IA tende a sempre usar "cuidado", "delicado", "naturalidade", "leveza" em todas as bios.
Para gerar verdadeira diversidade, adote EXCLUSIVAMENTE a MENTALIDADE DA FAMÍLIA EDITORIAL selecionada acima ("${chosenFamily.name}").
Você DEVE adotar os TEMAS FAVORECIDOS e é ESTRITAMENTE PROIBIDA de usar os TEMAS PROIBIDOS indicados acima para garantir que sua geração tenha identidade própria e nenhuma contaminação cruzada.

PROIBIDO EXPLICAR A PERSPECTIVA. Apenas aplique-a na essência da frase. NÃO use adjetivos ou substantivos literais da perspectiva escolhida (ex: se for "praticidade", não escreva a palavra "praticidade", apenas descreva algo prático ou que demonstre isso). A perspectiva deve influenciar o texto de forma puramente IMPLÍCITA, baseando a Headline e a Bio exclusivamente nessa lente.

DIRETRIZES DE ESTILO PARA BIO (ATENÇÃO: LEVEZA, NATURALIDADE E VERDADE, SEM PARECER ESCRITA POR IA OU COPYWRITER):
1. Crie um texto de MÁXIMO 25 PALAVRAS. O texto deve ser extremamente curto, no máximo 2 frases.
2. A bio deve ter variedade de abertura. Para soar natural e fugir do lugar-comum, PULE a auto-apresentação com verbos triviais (NÃO inicie com "Trabalho", "Atendo", "Sou", "Preparo", "Faço", "Meu objetivo"). Comece diretamente pelo mundo da cliente (ex: "Peles maduras...", "Seus pés..."), pelo ambiente ("Em silêncio..."), pelo resultado ou por um detalhe prático da sua forma de cuidar, sem muletas introdutórias.
3. NUNCA tente provar competência ou elencar cursos (PROIBIDO iniciar com "Atuo na área há...", "Tenho X anos de experiência...", "Ao longo dos últimos anos...", "Sou profissional", ou "Com expertise"). Vá direto ao espaço do cliente, situação do dia a dia ou forma prática de conduzir o horário, sem usar verbos desgastados de auto-apresentação.
4. Quando for relevante para a especialidade, use pequenos detalhes da forma de executar o serviço. Não torne todas as bios clínicas, e não foque sempre em etapas como higienização ou preparação.
5. Priorize a SIMPLICIDADE ELEGANTE: palavras diretas e concretas. Não faça mosaico ou listinha juntando as palavras do prompt soltas. Componha as frases de forma inteligente.

A REGRA DE EXPERIÊNCIA (MUITO IMPORTANTE):
É ESTRITAMENTE PROIBIDO MENCIONAR O NÚMERO DE ANOS DE EXPERIÊNCIA NA BIO. NÃO digite números como "5 anos", "10 anos", etc. Em vez disso, simplesmente demonstre maturidade dizendo como você trabalha hoje de forma sólida e segura. NÃO ESCREVA "Sou profissional com experiência". Fale como uma pessoa normal.

REGRA DE PRECISÃO ABSOLUTA E SEPARAÇÃO SEMÂNTICA (CRÍTICA!):
- O repertório NÃO representa serviços confirmados. Você é ESTRITAMENTE PROIBIDA de afirmar que a profissional executa qualquer técnica presente no repertório se ela não estiver nos DADOS DA PROFISSIONAL.
- É ESTRITAMENTE PROIBIDO fundir palavras, técnicas, metáforas ou dores de uma especialidade em outra. 
  * Massoterapeutas e Esteticistas corporais NÃO cuidam de unhas ou cutículas, NÃO fazem alongamentos ou fios. Trabalham tensão, musculatura, relaxamento.
  * Podólogas NÃO fazem skincare, limpeza de pele facial ou alongamentos com cola, apenas pés, pisada, pele do pé.
  * Trancistas NÃO fazem massagem profunda nem alongamento de unhas ou cutículas. Lidam com raiz, fios, tração, couros cabeludos.
  * Nail design e Manicure NÃO lidam com dores musculares nem derme facial. Lidam com unhas, resistência, esmaltação, formato, saúde da lâmina.
  * Lash (Cílios) NÃO faz sobrancelha a não ser que informado (lidam com pálpebra, fios soltos, isolamento).
- NÃO invente missões emocionais ("Quero ajudar você a se sentir..."). Mencione apenas fidedignamente o que está nos DADOS DA PROFISSIONAL.

REGRAS ANTI-CÓPIA E CONTAMINAÇÃO:
- A saída final deve usar somente termos compatíveis com a especialidade recebida em \`specialty\`. Nunca use técnicas, serviços ou palavras de outra profissão.
- Os exemplos e diretrizes servem APENAS para entender o estilo e a forma (curta, respirável). NUNCA copie literalmente as frases de exemplo para a saída final. Crie uma headline ORIGINAL para a usuária focada na especialidade dela.

REGRAS ESTRITAS POR ESPECIALIDADE (BLOQUEIOS):
- Se specialty for Maquiadora ou Maquiagem: proibir esmaltação, unha, gel, banho de gel, cutícula, sobrancelha, limpeza de pele, bronze.
- Se specialty for Esteticista: proibir esmaltação, unha, manicure, banho de gel, cílios, maquiagem, bronze.
- Se specialty for Bronzeamento: proibir solução de verão, solução de pele, sol e sombra, esmaltação, unha, limpeza de pele.
- Se specialty for Lash/Cílios: proibir sobrancelha, henna, esmaltação, maquiagem, limpeza de pele.
- Se specialty for Sobrancelhas: proibir cílios, volume russo, esmaltação, maquiagem, limpeza de pele.
- Se specialty for Trancista: proibir massagem, relaxamento, ansiedade, redução de estresse, espiritual.
- Se specialty for Podologia ou Massagista: proibir médica, clínica, fisioterapeuta, diagnósticos clínicos.

AUTO-CHECK FINAL ANTES DE RESPONDER: 
Antes de retornar o JSON:
1. Verifique se alguma técnica específica foi afirmada.
2. Pergunte-se: "Essa técnica foi realmente fornecida pela profissional?"
3. Se NÃO foi fornecida: substituir por descrição amplas e factuais da área de atuação.
4. Só então gerar a headline e bio finais.
5. Confira mentalmente: a headline e a bio poderiam pertencer a outra especialidade? Elas citam algum serviço fora da especialidade recebida? A bio contém emoções inventadas não enviadas nos dados da profissional? Se sim, reescreva focando nos fatos concretos e frios.

Retorne APENAS um JSON válido, puro, sem marcações markdown, estruturado exatamente assim:
{"headline": "Headline gerada", "bio": "Bio gerada"}
`;
}

const specs = [
  "Manicure", "Lash Designer", "Micropigmentadora", "Esteticista", "Maquiadora",
  "Sobrancelhas", "Cabeleireira", "Trancista", "Podóloga", "Terapeuta Capilar",
  "Depiladora", "Nail Designer", "Bronzeamento", "Massoterapeuta"
];

const bcs = [
  "Gosto de atender sem pressa",
  "Minhas clientes querem durabilidade",
  "Atendo peles maduras",
  "Foco em recuperar danos anteriores",
  "Trabalho em silêncio para a cliente relaxar",
  "Adoro quando a cliente pede algo delicado",
  "Meu estúdio é aconchegante e calmo",
  "Procuro entender o dia a dia da cliente antes de começar",
  "Especializada em técnicas sem dor",
  "Trabalho rápido mas bem feito para quem não tem tempo"
];

async function run() {
  let results = [];
  try {
     results = JSON.parse(fs.readFileSync('generation_p3_results.json', 'utf8'));
  } catch(e){}
  
  console.log('Generating bios in sequence...');
  for (let i = 0; i < 15; i++) {
     const spec = specs[i % specs.length];
     const bc = bcs[i % bcs.length];
     const pData = {
        name: `Profissional ${i + 1}`,
        specialty: spec,
        yearsExperience: "5",
        serviceStyle: ["Eficiente", "Carinhosa"],
        differentials: ["Materiais descartáveis"],
        bioContext: bc
      };
      const prompt = getPrompt(pData);
      try {
        const response = await callNvidiaAI([{ role: 'user', content: prompt }], {
          model: 'meta/llama-3.1-8b-instruct',
          temperature: 0.6,
          max_tokens: 512,
        });
        let cleaned = response.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        let parseRes;
        try {
          const firstBrace = cleaned.indexOf('{');
          const lastBrace = cleaned.lastIndexOf('}');
          if (firstBrace >= 0 && lastBrace >= firstBrace) { cleaned = cleaned.substring(firstBrace, lastBrace + 1); }
          parseRes = JSON.parse(cleaned);
        } catch(e) {
          parseRes = { headline: "Parse Error", bio: cleaned };
        }
        results.push({ specialty: spec, headline: parseRes.headline, bio: parseRes.bio });
        console.log(`[${i+1}/15] ${spec} ok.`);
      } catch(e) {
        results.push({ specialty: spec, headline: "API Error", bio: e.message });
      }
      fs.writeFileSync('generation_p3_results.json', JSON.stringify(results, null, 2));
      await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('Finished 100 generations.');
}

run();
