const fs = require('fs');
const file = 'server/emails/sendEmail.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('isValidEmail')) {
  code = code.replace(
    "function getResendClient() {",
    "function isValidEmail(email?: string | null): boolean {\n  if (!email || typeof email !== 'string') return false;\n  const trimmed = email.trim();\n  return trimmed.length > 3 && trimmed.includes('@');\n}\n\nfunction getResendClient() {"
  );

  code = code.replace(/if \(\!clientEmail\) \{/g, "if (!isValidEmail(clientEmail)) {");
  code = code.replace(/if \(\!professionalEmail\) \{/g, "if (!isValidEmail(professionalEmail)) {");
  code = code.replace(/if \(\!data\.email\) \{/g, "if (!isValidEmail(data.email)) {");
  code = code.replace(/if \(\!email\) \{/g, "if (!isValidEmail(email)) {");
  code = code.replace(/if \(\!referrerEmail\) \{/g, "if (!isValidEmail(referrerEmail)) {");

  fs.writeFileSync(file, code);
}
