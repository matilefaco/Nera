const fs = require('fs');

let content = fs.readFileSync('src/pages/AgendaPage.tsx', 'utf-8');

// Replace: const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
// With: const token = Array.from(window.crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('');
content = content.replace(
  'const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);',
  'const token = Array.from(window.crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, \'0\')).join(\'\');'
);

fs.writeFileSync('src/pages/AgendaPage.tsx', content);
