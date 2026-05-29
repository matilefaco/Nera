import dotenv from "dotenv";
dotenv.config();

const url = "https://integrate.api.nvidia.com/v1/chat/completions";

async function runTest(specialtyName, family) {
    const prompt = `Você é uma profissional real da área de beleza e bem-estar no Brasil, descrevendo seu próprio trabalho para clientes no seu perfil ou Instagram.
Seu objetivo é gerar uma Frase Principal (headline) curta e uma Mini Bio (bio). A linguagem deve soar HUMANA, NATURAL, DISCRETA e PROFISSIONAL.

DADOS DA PROFISSIONAL:
- Nome: A profissional
- Profissão real/Especialidade: ${specialtyName}
- Tempo na área: Profissional com experiência
- Estilo: Cuidadoso
- Diferenciais focais: Bom atendimento

FAMÍLIA EDITORIAL SELECIONADA: ${family.name.toUpperCase()}
- VOCABULÁRIO E TEMAS FAVORECIDOS: ${family.favored}
- VOCABULÁRIO E TEMAS ESTRITAMENTE PROIBIDOS: ${family.avoid}

INSTRUÇÕES EDITORIAIS CRÍTICAS:
O tom exigido é "Conversa humana e profissional": transmita confiança através da clareza e naturalidade. Diga o que você faz de forma concreta, sem exageros.
NUNCA soe como um copywriter publicitário. Fale com naturalidade, segurança e modéstia.

PALAVRAS PROIBIDAS GERAIS: "premium", "luxo", "exclusiva", "excelência", "transformar vidas", "realçar", "atendimento personalizado", "alta qualidade", "especialista".

DIRETRIZES DE DIVERSIDADE EDITORIAL (MUITO IMPORTANTE PARA EVITAR REPETIÇÃO):
Evite os padrões que causam homogeneização. A IA tende a sempre usar "cuidado", "delicado", "naturalidade", "leveza" em todas as bios.
Para gerar verdadeira diversidade, adote EXCLUSIVAMENTE a MENTALIDADE DA FAMÍLIA EDITORIAL selecionada acima ("${family.name}").
Você DEVE adotar os TEMAS FAVORECIDOS e é ESTRITAMENTE PROIBIDA de usar os TEMAS PROIBIDOS indicados acima para garantir que sua geração tenha identidade própria e nenhuma contaminação cruzada.

PROIBIDO EXPLICAR A PERSPECTIVA. Apenas aplique-a na essência da frase. NÃO use adjetivos ou substantivos literais da perspectiva escolhida (ex: se for "praticidade", não escreva a palavra "praticidade", apenas descreva algo prático ou que demonstre isso). A perspectiva deve influenciar o texto de forma puramente IMPLÍCITA, baseando a Headline e a Bio exclusivamente nessa lente.

DIRETRIZES DE ESTILO PARA BIO E HEADLINE:
1. A headline deve ser CURTA e DIRETA.
2. A bio deve ter de 1 a 2 frases e ritmo humano, escrita na 1ª pessoa.
3. Não preencha com adjetivos performáticos.

Retorne APENAS um JSON válido estruturado assim: {"headline": "...", "bio": "..."}
`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NVIDIA_API_KEY}`
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-8b-instruct",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.9,
          max_tokens: 200,
          response_format: { type: "json_object" }
        })
      });
      const data = await res.json();
      if(data.choices && data.choices[0]) {
        const c = JSON.parse(data.choices[0].message.content);
        console.log(`HL: ${c.headline}\nBIO: ${c.bio}`);
      }
    } catch(e) {}
}

async function start() {
  const families = [
      { name: 'praticidade', favored: 'rotina, praticidade, manutenção, dia a dia, funcional', avoid: 'criatividade, nail art, precisão, detalhes' },
      { name: 'criatividade', favored: 'expressão, personalidade, combinações, estilo, visual', avoid: 'rotina, manutenção, praticidade' },
      { name: 'minimalismo', favored: 'leveza, discrição, simplicidade, visual limpo, menos é mais', avoid: 'nail art, criatividade, detalhes, precisão' },
      { name: 'durabilidade', favored: 'resistência, estrutura, longa duração, manutenção reduzida', avoid: 'criatividade, minimalismo' },
      { name: 'detalhes', favored: 'acabamento, desenho, observação, simetria', avoid: 'praticidade, rotina, durabilidade' }
  ];
  for (const f of families) {
    console.log(`\n\n=== Nail Designer (${f.name}) ===`);
    await runTest('Nail Designer', f);
  }
}
start();
