import dotenv from "dotenv";
dotenv.config();

const url = "https://integrate.api.nvidia.com/v1/chat/completions";

async function testBio(specialtyName) {
  console.log(`\n== ${specialtyName.toUpperCase()} ==`);
  
  let exampleBio = '';
  
  if (specialtyName === 'Nail Designer') {
    exampleBio = 'Exemplo (Direção de tom para sua profissão): "Unhas com acabamento delicado e visual natural para a rotina do dia a dia. Alongamentos bem feitos, resistentes e que não parecem artificiais."';
  } else if (specialtyName === 'Trancista') {
    exampleBio = 'Exemplo (Direção de tom para sua profissão): "Tranças feitas com carinho, técnica e paciência. Trabalho sempre pautado pelo cuidado com a textura e a saúde do seu cabelo natural."';
  }

  const prompt = `Você é uma profissional real da área de beleza e bem-estar no Brasil, descrevendo seu próprio trabalho para clientes no seu perfil ou Instagram.
Seu objetivo é gerar uma Frase Principal (headline) curta e uma Mini Bio (bio) baseada EXCLUSIVAMENTE nos dados abaixo.

Dados da Profissional:
- Nome: Profissional Teste
- Profissão real/Especialidade: ${specialtyName}
- Tempo na área: Profissional com experiência
- Estilo: Cuidadoso
- Diferenciais focais: Bom atendimento

DIRETRIZES DE ESTILO PARA BIO (ATENÇÃO: LEVEZA, NATURALIDADE E VERDADE, SEM PARECER ESCRITA POR IA OU COPYWRITER):
1. Crie um texto de 1 a 2 frases curtas. 
2. A bio deve ter ritmo humano, leitura ágil e natural. Escrita na 1ª pessoa.
3. NUNCA tente provar competência, justificar experiência, ou adicionar um polimento artificial. Cuidado com o tom "premium/copywriter" enlatado.
4. NUNCA soe como um currículo corporativo. PROIBIDO: "Com experiência de...", "Trabalho com técnicas avançadas...", "Sempre atualizada..."
5. NUNCA soe como manifesto luxuoso de branding. ESTRITAMENTE PROIBIDO usar excesso de intenção ou abstrações: "o objetivo é trazer", "focado em", "priorizando", "buscando", "acabamento sofisticado", "beleza duradoura", "respeito absoluto", "estrutura fina", "resultado impecável", "design refinado", "toque sofisticado", "experiência premium".
6. Priorize a SIMPLICIDADE ELEGANTE: descreva a parte física, os atributos concretos do trabalho sem adornos publicitários. A naturalidade e o silêncio também são formas de elegância. Não preencha com adjetivos performáticos.
7. ${exampleBio}

Retorne APENAS um JSON válido, puro, estruturado exatamente assim:
{"headline": "...", "bio": "..."}
`;

  for(let i=0; i<3; i++) {
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
          temperature: 0.7,
          max_tokens: 200,
          response_format: { type: "json_object" }
        })
      });

      const data = await res.json();
      if (!data.choices) return;
      const content = JSON.parse(data.choices[0].message.content);
      console.log(`[Bio ${i}] => ${content.bio}`);
      await new Promise(r => setTimeout(r, 600)); 
    } catch (e) {
      console.error(e.message);
    }
  }
}

async function run() {
  await testBio('Nail Designer');
  await testBio('Trancista');
}

run();
