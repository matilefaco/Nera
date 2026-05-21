import fs from 'fs';
import path from 'path';

function replaceConsole(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/console\.log\(\s*`?\[/g, 'logger.info("AI", "[');
  content = content.replace(/console\.log\(\s*\'?\[/g, 'logger.info("AI", "[');
  content = content.replace(/console\.log\(\s*\"?\[/g, 'logger.info("AI", "[');
  
  content = content.replace(/console\.warn\(\s*`?\[/g, 'logger.warn("AI", "[');
  content = content.replace(/console\.warn\(\s*\'?\[/g, 'logger.warn("AI", "[');
  content = content.replace(/console\.warn\(\s*\"?\[/g, 'logger.warn("AI", "[');

  content = content.replace(/console\.error\(\s*`?\[/g, 'logger.error("AI", "[');
  content = content.replace(/console\.error\(\s*\'?\[/g, 'logger.error("AI", "[');
  content = content.replace(/console\.error\(\s*\"?\[/g, 'logger.error("AI", "[');
  
  // utils
  content = content.replace(/console\.log\(\`\[/g, 'logger.info("AI", "[');
  content = content.replace(/console\.warn\(\`\[/g, 'logger.warn("AI", "[');
  content = content.replace(/console\.error\(\`\[/g, 'logger.error("AI", "[');

  content = content.replace(/console\.log\(\'\[/g, 'logger.info("AI", "[');
  content = content.replace(/console\.warn\(\'\[/g, 'logger.warn("AI", "[');
  content = content.replace(/console\.error\(\'\[/g, 'logger.error("AI", "[');

  fs.writeFileSync(file, content, 'utf8');
}

replaceConsole('server/routes/analyticsRoutes.ts');
replaceConsole('server/utils.ts');

console.log("Done");
