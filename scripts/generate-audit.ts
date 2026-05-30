import dotenv from "dotenv";
dotenv.config();

import { callNvidiaAI } from "../server/utils.ts";
import fs from 'fs';

function getPrompt(profile) {
  const { name, specialty, yearsExperience, serviceStyle, differentials, bioStyle, bioContext } = profile;
  
  const lowerSpec = (specialty || '').toLowerCase();
  
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
      { name: 'bem-estar', favored: 'conforto, relaxamento, pausa, momento seu', avoid: 'transformação radical, correção estrutural' },
      { name: 'detalhes', favored: 'observação, técnica, cuidado, sutileza', avoid: 'mudança bruta, impacto agressivo' },
      { name: 'naturalidade', favored: 'essência, traço real, harmonia natural', avoid: 'artifício exagerado, artificialidade extrema' }
    ];
  }

  const chosenFamily = families[Math.floor(Math.random() * families.length)];
  let repertoireSection = '';

  const prompt = `Você é uma profissional real da área de beleza e bem-estar no Brasil, descrevendo seu próprio trabalho para clientes no seu perfil ou Instagram.
Seu objetivo é gerar uma Frase Principal (headline) curta e uma Mini Bio (bio) baseada EXCLUSIVAMENTE nos dados abaixo.

A linguagem deve soar HUMANA, NATURAL, DISCRETA e PROFISSIONAL.
NUNCA escreva como um copywriter publicitário. Fale com naturalidade, segurança e modéstia, como se explicasse o que você faz para uma nova cliente.

DADOS DA PROFISSIONAL:
- Nome: ${name || 'A profissional'}
- Profissão real/Especialidade: ${specialty || 'Beleza e Bem-estar'}
- Tempo na área: ${yearsExperience ? yearsExperience : 'Profissional com experiência'}
- Estilo: ${Array.isArray(serviceStyle) ? serviceStyle.join(', ') : (serviceStyle || 'Cuidadoso')}
- Diferenciais focais: ${Array.isArray(differentials) ? differentials.join(', ') : (differentials || 'Bom atendimento')}

CONTEXTO ADICIONAL INFORMADO PELA PROFISSIONAL (FONTE PRINCIPAL DE DIFERENCIAÇÃO):
${bioContext ? `"${bioContext}"

MÁXIMA PRIORIDADE - ESTE CONTEXTO É SOBERANO:
1. Ele é a principal fonte de diferenciação e contexto humano desta profissional.
2. Extraia temas centrais, perfil de cliente, preferências técnicas ou foco de atendimento.
3. Você DEVE garantir que a HEADLINE e a BIO reflitam claramente esse contexto. Não copie literalmente, mas adapte-o para uma narrativa profissional. Se a profissional citar um problema comum das clientes (ex: unhas roídas, pele sensível, queda capilar), aborde o CUIDADO, FORTALECIMENTO ou RESOLUÇÃO desse problema na Bio de forma humana.
4. Em caso de conflito, as informações acima sobrescrevem a Família Editorial listada abaixo. A Família servirá apenas como guia secundário de tom.` : 'Não informado'}
${repertoireSection}
INSTRUÇÕES EDITORIAIS CRÍTICAS (LEIA COM MÁXIMA ATENÇÃO):
O tom exigido é "Conversa humana e profissional": transmita confiança através da clareza e naturalidade. Diga o que você faz de forma concreta, sem exageros.

PALAVRAS E EXPRESSÕES ESTRITAMENTE PROIBIDAS (NÃO USE NUNCA):
- Estruturas de Currículo / LinkedIn (PROIBIDAS): "profissional", "especializada", "especialista em", "alta durabilidade", "segura", "duradoura", "atendimento personalizado", "com qualidade", "alta qualidade", "com amor e dedicação", "com técnicas modernas", "experiência em", "sucesso em", "seguro e duradouro"
- Marketing/coach/luxo: "premium", "luxo", "exclusiva", "excelência", "experiência única", "autoestima", "transformar vidas", "realçar sua beleza", "revelar sua melhor versão", "soberana", "atendimento diferenciado", "resultados extraordinários", "alto padrão", "alta performance", "incrível", "maravilhosa"
- Cafonas/Artificiais: "cuido das suas unhas como cuido das minhas", "quando você sair, vai querer voltar", "arte em cada milímetro", "olhar que hipnotiza", "beleza que transforma", "unhas dos sonhos", "cílios que falam por você"
- Clínico/acadêmico: "biologia da pele", "anatomia", "avaliação criteriosa", "protocolos de biossegurança", "metodologia", "estrutura anatômica", "processos rigorosos", "procedimentos avançados", "excelência técnica", "fisiologia"
- GENÉRICOS (EVITE FORTEMENTE): "Trabalho com cuidado", "Faço com carinho", "Atenção aos detalhes", "Resultados duradouros", "Atendimento personalizado", "Qualidade em cada detalhe", "Carinho e dedicação", "Focado em", "priorizando", "buscando", "meu objetivo é"

DIRETRIZES DE ESTILO PARA HEADLINE (FOCO EM CONCRETUDE E NATURALIDADE):
1. A headline deve ser CURTA, RESPIRÁVEL e DIRETA. Ela ficará na área principal da sua vitrine.
2. A headline NUNCA deve soar como um currículo, perfil de LinkedIn ou marketplace genérico (EXATAMENTE PROIBIDO: "Profissional especializada em X", "Designer profissional", "Especialista em beleza").
3. Prefira combinar uma MATERIALIDADE/TÉCNICA com o RESULTADO VISUAL REAL. (ex: "[Nome da Técnica] com [Aspecto Natural]").
4. A headline DEVE ter MUITA naturalidade. Sem excesso de adjetivos. É PROIBIDO usar palavras como "sofisticado", "refinado", "impecável", "excelência", "premium".
Exemplos de direção correta (INSPIRAÇÃO ESTRUTURAL APENAS - É ESTRITAMENTE PROIBIDO COPIAR ESSAS FRASES):
- Alongamentos naturais e leves para o dia a dia
- Tranças bem cuidadas e alinhadas
- Design cuidadoso respeitando seu formato natural
- Cílios com volume sob medida
- Cuidados faciais básicos e eficientes
- Estética com foco em naturalidade
- Esmaltação em gel fina e resistente
Exemplos RUINS (PROIBIDOS NESSA IA: currículo, robótico, LinkedIn, genérico):
- "Manicure segura e duradoura"
- "Lash designer profissional"
- "Micropigmentadora especializada"
- "Atendimento personalizado de qualidade"
- "Especialista em beleza"
- "Técnica moderna e alta durabilidade"

FAMÍLIA EDITORIAL SELECIONADA: ${chosenFamily.name.toUpperCase()}
- VOCABULÁRIO E TEMAS FAVORECIDOS: ${chosenFamily.favored}
- VOCABULÁRIO E TEMAS ESTRITAMENTE PROIBIDOS: ${chosenFamily.avoid}

DIRETRIZES DE DIVERSIDADE EDITORIAL (MUITO IMPORTANTE PARA EVITAR REPETIÇÃO):
Evite os padrões que causam homogeneização. A IA tende a sempre usar "cuidado", "delicado", "naturalidade", "leveza" em todas as bios.
Para gerar verdadeira diversidade, adote EXCLUSIVAMENTE a MENTALIDADE DA FAMÍLIA EDITORIAL selecionada acima ("${chosenFamily.name}").
Você DEVE adotar os TEMAS FAVORECIDOS e é ESTRITAMENTE PROIBIDA de usar os TEMAS PROIBIDOS indicados acima para garantir que sua geração tenha identidade própria e nenhuma contaminação cruzada.

PROIBIDO EXPLICAR A PERSPECTIVA. Apenas aplique-a na essência da frase. NÃO use adjetivos ou substantivos literais da perspectiva escolhida (ex: se for "praticidade", não escreva a palavra "praticidade", apenas descreva algo prático ou que demonstre isso). A perspectiva deve influenciar o texto de forma puramente IMPLÍCITA, baseando a Headline e a Bio exclusivamente nessa lente.

DIRETRIZES DE ESTILO PARA BIO (ATENÇÃO: LEVEZA, NATURALIDADE E VERDADE, SEM PARECER ESCRITA POR IA OU COPYWRITER):
1. Crie um texto de 1 a 2 frases curtas. 
2. A bio deve ter ritmo humano, leitura ágil e natural. Escrita na 1ª pessoa.
3. NUNCA tente provar competência, justificar experiência, ou adicionar um polimento artificial. Cuidado com o tom "premium/copywriter" enlatado.
4. NUNCA soe como um currículo corporativo. PROIBIDO: "Com experiência de...", "Trabalho com técnicas avançadas...", "Sempre atualizada...", "Atendimento personalizado".
5. NUNCA soe como manifesto luxuoso de branding. ESTRITAMENTE PROIBIDO usar excesso de intenção ou abstrações: "o objetivo é trazer", "focado em", "priorizando", "buscando", "acabamento sofisticado", "beleza duradoura", "respeito absoluto", "estrutura fina", "resultado impecável", "design refinado", "toque sofisticado", "experiência premium".
6. Priorize a SIMPLICIDADE ELEGANTE: descreva a parte física, os atributos concretos do trabalho sem adornos publicitários. A naturalidade e o silêncio também são formas de elegância. Não preencha com adjetivos performáticos.

REGRA DE PRECISÃO ABSOLUTA (PROIBIDO INVENTAR):
- O repertório NÃO representa serviços confirmados. Você é ESTRITAMENTE PROIBIDA de afirmar que a profissional executa qualquer técnica presente no repertório se ela não estiver nos DADOS DA PROFISSIONAL.
- NÃO invente especialidades nem serviços não informados.
- NÃO invente paixões ("Minha paixão é...", "Amo o que faço").
- NÃO invente motivações ou histórias ("Escolhi essa área porque...").
- NÃO invente missões emocionais ("Quero ajudar você a se sentir...").
Mencione apenas as suas técnicas, seus serviços, seu tempo de experiência e sua forma de trabalhar reais baseados nos DADOS DA PROFISSIONAL. Seja concreta. Fale de fatos reais, não de intenções românticas.

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
  return prompt;
}

async function run() {
  let existing = [];
  try {
    existing = JSON.parse(fs.readFileSync('generation_results.json', 'utf8'));
  } catch(e) {}

  let i = 0;
  for (let profile of existing) {
    if (profile.headline === "API Error" || profile.headline.includes("Error")) {
      const pData = {
        name: `Profissional ${i + 1}`,
        specialty: profile.specialty,
        yearsExperience: "5 anos",
        serviceStyle: ["Rápida", "Eficiente"],
        differentials: ["Atendimento pontual", "Especialista"],
        bioStyle: "conversational",
        bioContext: i % 2 === 0 ? "Minhas clientes procuram algo natural" : "Atendo muitas clientes exigentes"
      };

      const prompt = getPrompt(pData);
      try {
        const response = await callNvidiaAI([{ role: 'user', content: prompt }], {
          model: 'meta/llama-3.1-8b-instruct',
          temperature: 0.5,
          max_tokens: 512,
        });
        
        let cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
        let parseRes;
        try {
          parseRes = JSON.parse(cleaned);
        } catch(e) {
          parseRes = { headline: "Parse Error", bio: "Parse Error: " + cleaned };
        }

        profile.headline = parseRes.headline;
        profile.bio = parseRes.bio;
        console.log("Fixed", i, profile.specialty);
      } catch (e) {
        console.error('Error generating for', profile.specialty, e.message);
      }
      fs.writeFileSync('generation_results.json', JSON.stringify(existing, null, 2));
      // sequential to avoid rate limit
      await new Promise(res => setTimeout(res, 1000));
    }
    i++;
  }

  console.log('Finished!');
}

run();
