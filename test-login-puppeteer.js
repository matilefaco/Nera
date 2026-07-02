import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.toString()}`);
  });

  console.log('Navigating to http://localhost:3000/ ...');
  try {
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 10000 });
    console.log('Landing page loaded. Title:', await page.title());

    console.log('Clicking the "Entrar" (Login) link...');
    // Click the Link that goes to /login (nav-link with text "Entrar")
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }),
      page.click('a[href="/login"]')
    ]);

    console.log('Navigated to /login. Current URL:', page.url());
    
    // Wait a moment for rendering
    await new Promise(resolve => setTimeout(resolve, 2000));

    const errorTrace = await page.evaluate(() => {
      const el = document.getElementById('error-trace');
      return el ? el.innerText : null;
    });

    if (errorTrace) {
      console.log('=== ERROR TRACE FOUND AFTER CLICK ===');
      console.log(errorTrace);
      console.log('=====================================');
    } else {
      console.log('No error-trace element found after navigation click.');
    }

    console.log('Body text after click:', await page.evaluate(() => document.body.innerText.slice(0, 500)));

  } catch (err) {
    console.error('Click navigation or test failed:', err);
  } finally {
    await browser.close();
  }
}

run();
