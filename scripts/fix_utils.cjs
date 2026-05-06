const fs = require('fs');
let lines = fs.readFileSync('src/lib/utils.ts', 'utf-8').split('\n');
lines[274] = '  const sentences = trimmedBio.match(/[^.!?]+[.!?]+(?:\\\\s+|\\\\n|$)/g) || [trimmedBio];';
// delete line 275
lines.splice(275, 1);
fs.writeFileSync('src/lib/utils.ts', lines.join('\n'));
