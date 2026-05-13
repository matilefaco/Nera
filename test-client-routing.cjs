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

  console.log('Navigating to http://localhost:3000/');
  const response = await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 30000 });
  
  // Now evaluate clicking or navigating via history API to avoid hitting the server for index.html
  await page.evaluate(() => {
    window.history.pushState({}, '', '/p/jajajsje');
    // We need to trigger the react router. The easiest way is to dispatch a popstate event
    const popStateEvent = new PopStateEvent('popstate');
    window.dispatchEvent(popStateEvent);
  });
  
  await page.waitForTimeout(5000);
  
  const content = await page.evaluate(() => document.body.innerText);
  console.log('[PAGE AFTER CLIENT ROUTING PREVIEW]:\\n' + content.substring(0, 500));
  
  await browser.close();
})();
