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
  page.on('requestfailed', request => {
    const err = request.failure();
    if(err && !request.url().includes('google-analytics') && !request.url().includes('clarity')) {
      console.log(`[NETWORK ERROR] ${request.url()} - ${err.errorText}`);
    }
  });

  console.log('Navigating to http://localhost:3000/p/jajajsje');
  const response = await page.goto('http://localhost:3000/p/jajajsje', { waitUntil: 'load', timeout: 30000 });
  console.log(`[RESPONSE STATUS] ${response.status()}`);
  
  await page.waitForTimeout(5000);
  
  const content = await page.evaluate(() => document.body.innerText);
  console.log('[PAGE CONTENT PREVIEW]:\\n' + content.substring(0, 500));
  
  await browser.close();
})();
