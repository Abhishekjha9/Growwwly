import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2
  });
  const page = await context.newPage();
  
  try {
    await page.goto('http://localhost:3000/analyze', { waitUntil: 'networkidle', timeout: 30000 });
    // Wait a bit for animations
    await page.waitForTimeout(2000);
    
    if (!fs.existsSync('docs/screenshots')) {
      fs.mkdirSync('docs/screenshots', { recursive: true });
    }
    
    await page.screenshot({ path: 'docs/screenshots/landing-page.png' });
    console.log('Landing page captured.');
  } catch (err) {
    console.error('Error capturing landing page:', err);
  }

  await browser.close();
})();
