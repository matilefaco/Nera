import * as fs from "fs";
import * as path from "path";

const dirToScan = [
  "src",
  "server"
];

function processFile(filePath: string) {
  let content = fs.readFileSync(filePath, "utf-8");
  const originalLength = content.length;
  
  // Regex to match typical dev console logs. 
  // We'll replace entire lines if they only contain whitespace + console.log(...)
  // E.g., `    console.log("...");`
  // And also `isDev && console.log(...)`
  
  // basic one-liners
  const cleanContent = content.split('\n').filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('console.log(') && (trimmed.endsWith(');') || trimmed.endsWith(')'))) {
        return false;
    }
    if (trimmed.startsWith('if (import.meta.env.DEV) console.log(')) return false;
    if (trimmed.startsWith('const devLog = ')) return false;
    if (trimmed.startsWith('devLog(')) return false;
    return true;
  }).join('\n');
  
  if (cleanContent !== content) {
    fs.writeFileSync(filePath, cleanContent);
    console.log(`Cleaned: ${filePath}`);
  }
}

function scanDir(dirName: string) {
  const entries = fs.readdirSync(dirName);
  for (const entry of entries) {
    const fullPath = path.join(dirName, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      if (entry !== 'node_modules' && entry !== 'dist') {
        scanDir(fullPath);
      }
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      processFile(fullPath);
    }
  }
}

dirToScan.forEach(scanDir);
console.log("Cleanup done!");
