import fs from 'fs';

const data = JSON.parse(fs.readFileSync('generation_p3_results.json', 'utf8'));

let headlines = [];
let bios = [];
let startWords = {};
let words = {};

let avalioCount = 0;
let preparoCount = 0;
let texturaFioCount = 0;
let xParaYCount = 0;
let contaminacaoCount = 0;
let expCount = 0;
let validBiosCount = 0;

data.forEach((d) => {
    if (d.headline === "API Error" || d.headline === "Parse Error") return;
    validBiosCount++;
    const h = d.headline || "";
    const b = d.bio || "";
    headlines.push(h);
    bios.push(b);
    
    // First words of bio
    const cleanBio = b.trim().replace(/[.,]/g, '').toLowerCase();
    const firstWord = cleanBio.split(' ')[0];
    startWords[firstWord] = (startWords[firstWord] || 0) + 1;
    
    if (firstWord === "avalio" || firstWord === "avaliação") avalioCount++;
    if (firstWord === "preparo" || firstWord === "preparação") preparoCount++;
    
    if (b.toLowerCase().includes("textura natural do fio") || b.toLowerCase().includes("textura natural do seu fio")) {
       texturaFioCount++;
    }
    
    // X para Y in headline
    if (h.toLowerCase().includes(" para ") || h.toLowerCase().match(/^[^\-]+ para .*$/)) {
       xParaYCount++;
    }
    
    // Exp
    if (b.toLowerCase().includes("anos de experiência") || b.toLowerCase().includes("experiência na área") || b.toLowerCase().includes("anos atuando") || b.toLowerCase().includes("anos de profissão")) {
       expCount++;
    }
    
    // Contaminacao
    const s = (d.specialty || '').toLowerCase();
    const lText = b.toLowerCase() + " " + h.toLowerCase();
    if (!s.includes('cabel') && !s.includes('trança') && !s.includes('sobran') && !s.includes('lash') && !s.includes('cílio')) {
       if (lText.includes('fio') || lText.includes('couro')) {
          contaminacaoCount++;
       }
    }
    
    // Word freq
    cleanBio.split(' ').forEach(w => {
       if (w.length > 3) {
          words[w] = (words[w] || 0) + 1;
       }
    });
});

console.log("=== RESULTS ===");
console.log(`Total Valid Bios: ${validBiosCount}`);
console.log(`% Avalio: ${((avalioCount/validBiosCount)*100).toFixed(1)}%`);
console.log(`% Preparo: ${((preparoCount/validBiosCount)*100).toFixed(1)}%`);
console.log(`% Textura natural do fio: ${((texturaFioCount/validBiosCount)*100).toFixed(1)}%`);
console.log(`% X para Y headlines: ${((xParaYCount/validBiosCount)*100).toFixed(1)}%`);
console.log(`% Contaminação (fio/couro em não-cabelo): ${((contaminacaoCount/validBiosCount)*100).toFixed(1)}%`);
console.log(`% Excesso de XP (anos de experiência): ${((expCount/validBiosCount)*100).toFixed(1)}%`);

console.log("\n=== START WORDS ===");
Object.keys(startWords).sort((a,b) => startWords[b] - startWords[a]).slice(0, 15).forEach(k => console.log(`${k}: ${startWords[k]}`));

console.log("\n=== FREQUENCY WORDS ===");
Object.keys(words).sort((a,b) => words[b] - words[a]).slice(0, 15).forEach(k => console.log(`${k}: ${words[k]}`));

let phrases = {};
bios.forEach(b => {
    const p = b.substring(0, Math.min(b.length, 30));
    phrases[p] = (phrases[p] || 0) + 1;
});

console.log("\n=== START OF BIOS (30 chars) ===");
Object.entries(phrases)
   .sort((a,b) => b[1] - a[1])
   .slice(0, 10)
   .forEach(e => console.log(`"${e[0]}": ${e[1]}`));

console.log("\n=== HEADLINES SAMPLE ===");
headlines.slice(0, 20).forEach(h => console.log("- " + h));

console.log("\n=== BIOS SAMPLE ===");
bios.slice(0, 20).forEach(b => console.log("- " + b));
