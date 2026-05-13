const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
const start = content.indexOf('        {/* GERAL CONTENT -> CONCENTRADO EM CRESCIMENTO */}');
const end = content.indexOf('      {/* --- SHARE VITRINE MODAL --- */}');
if (start !== -1 && end !== -1) {
  content = content.substring(0, start) + content.substring(end);
  fs.writeFileSync('src/pages/Dashboard.tsx', content);
  console.log('Successfully removed block.');
} else {
  console.log('Could not find start or end index.');
}
