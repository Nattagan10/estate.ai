import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

// Track network requests
const ragRequests = [];
page.on('request', req => {
  if (req.url().includes('/api/rag-chat')) ragRequests.push({ url: req.url(), method: req.method() });
});
page.on('response', async resp => {
  if (resp.url().includes('/api/rag-chat')) {
    ragRequests[ragRequests.length - 1].status = resp.status();
  }
});

console.log('1. Opening http://localhost:8081...');
await page.goto('http://localhost:8081', { waitUntil: 'networkidle2', timeout: 20000 });
await page.screenshot({ path: 'C:/Users/thana/estate.ai/test_1_loaded.png' });
console.log('   -> Page loaded');

// Verify initial state: button shows "AI" (useRag=false)
const initialTitle = await page.$eval(
  'button[title*="switch to bot_reccomend"]',
  el => el.title
).catch(() => null);
console.log('2. Initial button title:', initialTitle ? initialTitle.slice(0, 60) : 'NOT FOUND');

if (!initialTitle) {
  console.log('   ERROR: RAG toggle not found. Dumping all button titles:');
  const allButtons = await page.$$eval('button', els => els.map(el => ({ title: el.title, text: el.textContent?.trim().slice(0,20) })));
  console.log(allButtons.filter(b => b.title).slice(0,10));
  await browser.close();
  process.exit(1);
}

// Click toggle using page.click() which is more reliable
await page.click('button[title*="switch to bot_reccomend"]');
await new Promise(r => setTimeout(r, 1500));

// Verify toggle worked
const newTitle = await page.$eval(
  'button',
  () => null  // fallback
).catch(() => null);

// Check if there's now a button with "switch to estate.ai" (means useRag=true)
const ragActiveBtn = await page.$('button[title*="switch to estate.ai"]');
const aiBtn = await page.$('button[title*="switch to bot_reccomend"]');
console.log('   -> After click: RAG active button found:', ragActiveBtn !== null);
console.log('   -> After click: AI button still there:', aiBtn !== null);

await page.screenshot({ path: 'C:/Users/thana/estate.ai/test_2_rag_toggled.png' });

if (!ragActiveBtn) {
  console.log('   WARNING: RAG toggle may not have worked. Trying eval click...');
  await page.evaluate(() => {
    const btn = document.querySelector('button[title*="switch to bot_reccomend"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1500));
  const retryRag = await page.$('button[title*="switch to estate.ai"]');
  console.log('   -> After eval click: RAG active:', retryRag !== null);
}

// Find chat input and type message
console.log('3. Typing in chat...');
const chatInput = await page.$('input[placeholder*="Ask about"]');
if (!chatInput) {
  // Try other selectors
  const allInputs = await page.$$eval('input, textarea', els => els.map(el => ({
    tag: el.tagName, placeholder: el.placeholder, type: el.type
  })));
  console.log('   All inputs:', JSON.stringify(allInputs.slice(0,5)));
  await browser.close();
  process.exit(1);
}

await chatInput.click();
await chatInput.type('คอนโดใกล้ BTS อโศก', { delay: 50 });
console.log('   -> Typed query');

// Send
await page.keyboard.press('Enter');
console.log('4. Sent message, waiting for RAG response (up to 120s)...');
const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

// Poll every 3s until typing indicator gone (max 120s)
let waited = 0;
while (waited < 120000) {
  await new Promise(r => setTimeout(r, 3000));
  waited += 3000;
  const isTyping = await page.$eval('.typing-ellipsis', () => true).catch(() => false);
  process.stdout.write(`   waited ${waited/1000}s, typing=${isTyping}\n`);
  if (!isTyping) break;
}

await page.screenshot({ path: 'C:/Users/thana/estate.ai/test_3_after_response.png', fullPage: true });
console.log('   -> Screenshot after response saved');

// Check results section
console.log('5. Checking results...');
const allH2s = await page.$$eval('h2', els => els.map(el => el.textContent?.trim()));
console.log('   -> All h2s:', allH2s);

const cards = await page.$$('.property-card, [data-testid="property-card"], article');
console.log('   -> Property cards found:', cards.length);

// Scroll to AI results if visible
await page.evaluate(() => {
  const h2s = document.querySelectorAll('h2');
  for (const h of h2s) {
    if (h.textContent?.includes('AI') || h.textContent?.includes('แนะนำ') || h.textContent?.includes('Results')) {
      h.scrollIntoView({ behavior: 'instant' });
      break;
    }
  }
});
await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: 'C:/Users/thana/estate.ai/test_4_results_section.png' });
console.log('   -> Results section screenshot saved');

// Summary
console.log('\n--- Summary ---');
console.log('RAG requests intercepted:', ragRequests.length, ragRequests);
if (consoleErrors.length) console.log('Console errors:', consoleErrors);
else console.log('No console errors');

await browser.close();
console.log('\nDone! Screenshots at C:/Users/thana/estate.ai/test_*.png');
