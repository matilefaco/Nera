import fs from 'fs';

const data = JSON.parse(fs.readFileSync('generation_results.json', 'utf8'));

const allBios = data.map(d => d.bio);
const allHeadlines = data.map(d => d.headline);

function getNgrams(texts, n) {
  const counts = {};
  texts.forEach(text => {
    // Basic clean
    const words = text.toLowerCase().replace(/[.,!]/g, '').split(/\s+/);
    for(let i=0; i <= words.length - n; i++) {
        const gram = words.slice(i, i+n).join(' ');
        counts[gram] = (counts[gram] || 0) + 1;
    }
  });
  return Object.entries(counts).sort((a,b) => b[1] - a[1]).slice(0, 30);
}

console.log("=== HEADLINES (Trigrams) ===");
console.log(getNgrams(allHeadlines, 3));

console.log("\n=== HEADLINES (Bigrams) ===");
console.log(getNgrams(allHeadlines, 2));

console.log("\n=== BIOS (4-grams) ===");
console.log(getNgrams(allBios, 4));

console.log("\n=== BIOS (Trigrams) ===");
console.log(getNgrams(allBios, 3));

console.log("\n=== CLASSIFICATIONS ===");
let a=0, b=0, c=0, d=0;
data.forEach(p => {
    let text = (p.headline + " " + p.bio).toLowerCase();
    
    // Heuristics for classification
    // B - Copywriter: "transformar", "melhor versão" (actually they are banned in prompt, so maybe none)
    // C - AI: "5 anos de experiência, sou", "clientes exigentes", "atenção pontual"
    // D - Generic: "rápido e eficiente"
    // A - Real Professional: sounds natural
});
