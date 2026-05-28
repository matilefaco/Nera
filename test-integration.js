import dotenv from "dotenv";
dotenv.config();

async function run() {
  const specs = [
    { n: "Ana", spec: "Manicure", exp: "3-5 anos", style: "Delicada", diff: "Pontualidade" },
    { n: "Bruna", spec: "Lash Designer", exp: "Iniciante", style: "Rápida", diff: "Ambiente confortável" },
    { n: "Carol", spec: "Designer de sobrancelhas", exp: "5+ anos", style: "Natural", diff: "Produtos seguros" },
    { n: "Dani", spec: "Maquiadora", exp: "1-2 anos", style: "Elegante", diff: "Pontualidade" },
    { n: "Elisa", spec: "Esteticista", exp: "+10 anos", style: "Técnica", diff: "Produtos veganos" },
    { n: "Fernanda", spec: "Bronzeamento", exp: "5-10 anos", style: "Saudável", diff: "Atendimento vip" }
  ];
  
  for (const s of specs) {
    console.log(`\n=== Generating for ${s.spec} ===`);
    for (let i = 0; i < 5; i++) {
        const payload = {
          name: s.n,
          specialty: s.spec,
          yearsExperience: s.exp,
          serviceStyle: [s.style],
          differentials: [s.diff],
          bioStyle: "elegante"
        };
        const res = await fetch("http://localhost:3000/api/generate-content", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
               // bypass requireFirebaseAuth logic somehow?
            },
            body: JSON.stringify(payload)
        });
        const text = await res.text();
        console.log(`[${s.spec}] ${res.status}: ${text}`);
    }
  }
}
run();
