const fs = require('fs');
const glob = require('glob');

const tsxFiles = glob.sync('src/**/*.tsx');
const tsFiles = glob.sync('src/**/*.ts');
const allFiles = [...tsxFiles, ...tsFiles];

for (const file of allFiles) {
  let content = fs.readFileSync(file, 'utf-8');
  if (content.includes("\\n")) {
    content = content.replace(/\\n/g, "\n");
    fs.writeFileSync(file, content);
    console.log("Fixed", file);
  }
}
