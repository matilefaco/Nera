const fs = require('fs');

let content = fs.readFileSync('server/routes/notificationRoutes.ts', 'utf-8');

if (!content.includes('import { randomBytes } from "crypto";')) {
  content = content.replace('import express from "express";', 'import express from "express";\nimport { randomBytes } from "crypto";');
}

if (!content.includes('generateSecureToken')) {
  // Try to find a good place. After imports.
  const tokenFunc = `
// Tokens públicos de acesso precisam ser criptograficamente seguros. Não usar Math.random.
function generateSecureToken(bytes: number = 16): string {
  return randomBytes(bytes).toString("hex");
}
`;
  content = content.replace('const router = express.Router();', tokenFunc + '\nconst router = express.Router();');
}

content = content.replace(
  'const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);',
  'const token = generateSecureToken(24);'
);

fs.writeFileSync('server/routes/notificationRoutes.ts', content);
