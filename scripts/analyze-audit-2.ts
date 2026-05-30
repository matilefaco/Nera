import fs from 'fs';

const data = JSON.parse(fs.readFileSync('generation_results.json', 'utf8'));

let counts = { A: 0, B: 0, C: 0, D: 0 };

let examples = { A: [], B: [], C: [], D: [] };

data.forEach((p, idx) => {
    let text = (p.headline + " " + p.bio).toLowerCase();
    
    // Heuristics
    // A: No "5 anos", no "rápida e eficiente", no "clientes exigentes" - feels natural
    // B: Overuse of adjectives not explicitly banned but structured: "resultados visuais duradouros", "soluções naturais"
    // C: Literal repetition of input data in robotic way: "Com 5 anos de experiência", "Atendo clientes exigentes", "Atenção pontual e especialização"
    // D: Simply generic: "rápida e eficiente", "oferecer atendimento"
    
    // Let's manually review a sample or classify with logic
    let isC = text.includes("com 5 anos de experiência") || text.includes("há 5 anos") || text.includes("atendo clientes exigentes") || text.includes("atenção pontual");
    let isD = !isC && (text.includes("rápida e eficiente") || text.includes("rápido e") || text.includes("eficiência para") || text.includes("meu foco é"));
    let isB = !isC && !isD && (text.includes("resultados visuais") || text.includes("atraente") || text.includes("soluções práticas"));
    
    if (isC) { counts.C++; examples.C.push(p); }
    else if (isD) { counts.D++; examples.D.push(p); }
    else if (isB) { counts.B++; examples.B.push(p); }
    else { counts.A++; examples.A.push(p); }
});

console.log("CLASSIFICATION:", counts);
