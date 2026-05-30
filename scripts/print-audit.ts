import fs from 'fs';

const data = JSON.parse(fs.readFileSync('generation_results.json', 'utf8'));

let out = '';
data.forEach((p, i) => {
  out += `--- Perfil ${i+1} (${p.specialty}) ---\nHeadline: ${p.headline}\nBio: ${p.bio}\n\n`;
});

fs.writeFileSync('audit-print.txt', out);
console.log('Done!');
