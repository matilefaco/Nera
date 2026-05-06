const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.{tsx,ts}');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;

  // Replace literal newline inside single quotes `join('\n')` or `replace('\n', ...)`
  // A literal newline between single quotes is represented as:
  // '
  // '
  // Regex: /'\n'/g
  if (/\'\\n\'/g.test(content)) {
     content = content.replace(/\'\\n\'/g, "'\\\\n'");
     changed = true;
  }
  if (/\"\n\"/g.test(content)) {
     content = content.replace(/\"\n\"/g, '"\\\\n"');
     changed = true;
  }

  // However, my previous script injected:
  // console.log('...:', docSnap.exists());
  // if (docSnap.exists()) {
  // It literally means the source code has a newline there! Which is correctly parsed by JS!
  // Wait, so `AuthContext.tsx` had a syntax error?
  // Let's check what the syntax error was in AuthContext.tsx!
  fs.writeFileSync(file, content);
}
