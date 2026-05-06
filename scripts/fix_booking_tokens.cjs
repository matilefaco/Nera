const fs = require('fs');

let content = fs.readFileSync('server/routes/bookingRoutes.ts', 'utf-8');

if (!content.includes('import { randomBytes } from "crypto";')) {
  content = content.replace('import express from "express";', 'import express from "express";\nimport { randomBytes } from "crypto";');
}

if (!content.includes('generateSecureToken')) {
  const tokenFunc = `
// Tokens públicos de acesso precisam ser criptograficamente seguros. Não usar Math.random.
function generateSecureToken(bytes: number = 16): string {
  return randomBytes(bytes).toString("hex");
}

const generateRandomSuffix =`;
  content = content.replace('const generateRandomSuffix =', tokenFunc);
}

content = content.replace(
  'return Math.random().toString(36).substring(2, 2 + length).toUpperCase();',
  'return generateSecureToken(Math.ceil(length / 2)).substring(0, length).toUpperCase();'
);

content = content.replace(
  'const manageSlug = reservationCode.toLowerCase();',
  'const manageSlug = generateSecureToken(24);'
);

fs.writeFileSync('server/routes/bookingRoutes.ts', content);
