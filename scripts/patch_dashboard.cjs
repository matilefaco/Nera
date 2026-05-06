const fs = require('fs');
const content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const updated = content.replace(/const (\w+) = onSnapshot\([^,]+, \(s[^)]*\) => {([\s\S]*?)}\);/g, (match, param, body) => {
  if (match.includes(', (error) =>')) return match; // Skip if already there
  
  // Extract query parameter name (e.g., qAlerts, qAnalytics)
  const queryNameMatch = match.match(/onSnapshot\(([^,]+),/);
  const queryName = queryNameMatch ? queryNameMatch[1].trim() : 'query';

  return match.replace(/}\);$/, `}, (error) => {\n      console.error('[Dashboard] Subscription error on ${queryName}:', error);\n    });`);
});

fs.writeFileSync('src/pages/Dashboard.tsx', updated, 'utf8');
console.log('Done!');
