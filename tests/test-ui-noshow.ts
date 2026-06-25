import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));

  try {
    console.log("Navigating to app...");
    await page.goto('http://localhost:3000/login');
    
    // login
    console.log("Logging in...");
    await page.fill('input[type="email"]', 'matilefaco1@gmail.com');
    await page.fill('input[type="password"]', 'senha123');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 10000 });
    console.log("Logged in!");

    console.log("Navigating to agenda...");
    await page.goto('http://localhost:3000/agenda');
    await page.waitForTimeout(3000); // Wait for data to load

    // Look for an appointment card that says pending_confirmation or is clickable
    const appointmentCard = page.locator('div.cursor-pointer').first();
    if (await appointmentCard.count() > 0) {
        console.log("Clicking appointment card...");
        await appointmentCard.click();
        
        await page.waitForTimeout(1000);
        
        const noShowBtn = page.locator('button:has-text("Marcar Faltou (No-Show)")');
        if (await noShowBtn.count() > 0) {
            console.log("Clicking No-Show button...");
            await noShowBtn.click();
            await page.waitForTimeout(3000);
        } else {
            console.log("No-show button not found. Maybe not a past/pending appointment.");
        }
    } else {
        console.log("No appointments found in agenda.");
    }
  } catch (err) {
    console.error("Test error:", err);
  } finally {
    await browser.close();
  }
})();
