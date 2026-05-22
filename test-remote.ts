import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://ais-dev-63xlcjmrm7ywxwui656b4j-645724189341.us-east1.run.app/p/helena-prado', { waitUntil: 'networkidle2' });
    const text = await page.evaluate(() => document.body.innerText);
    console.log('PAGE TEXT:', text.substring(0, 500));
  } catch(e) {
    console.error('Nav error', e);
  }
  
  await browser.close();
})();
