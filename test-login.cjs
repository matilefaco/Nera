const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.message}`);
  });

  console.log('Navigating to http://localhost:3000/login');
  const response = await page.goto('http://localhost:3000/login', { waitUntil: 'load', timeout: 30000 });
  
  await page.waitForTimeout(5000);
  
  const content = await page.evaluate(() => document.body.innerText);
  console.log('[LOGIN CONTENT PREVIEW]:\\n' + content.substring(0, 500));
  
  await browser.close();
})();
