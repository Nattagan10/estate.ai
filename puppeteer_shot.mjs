import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto('http://localhost:8080', { waitUntil: 'networkidle2', timeout: 15000 });

// Type in chat input to trigger area filter
const input = await page.$('input[placeholder*="location"]');
if (input) {
  await input.click();
  await input.type('Asok', { delay: 80 });
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 6000)); // wait for AI + map update
}

await page.screenshot({ path: 'C:/Users/thana/estate.ai/screenshot_zone_final.png', fullPage: false });
await browser.close();
