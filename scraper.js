const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function omniFixScrape() {
  const url = process.env.AI_URL || "https://aistudio.google.com/u/1/apps/drive/1C95LlT34ylBJSzh30JU2J1ZlwMZSIQrx?showPreview=true&showAssistant=true";
  const rawCookies = process.env.SESSION_COOKIES || '[]';
  
  console.log('🛡️ [V15.2] Initializing Omni-Fix Protocol...');

  // Create a local user data dir to avoid profile locking issues in CI
  const userDataDir = path.join(process.cwd(), '.chrome-user-data');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const launchOptions = {
    headless: "new",
    executablePath: process.env.CHROME_BIN || undefined,
    userDataDir: userDataDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // Critical for Docker/CI memory
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-extensions',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // Faster in containerized runners
      '--window-size=1280,960'
    ]
  };

  console.log('🔍 [DEBUG] Launch Config:', JSON.stringify({
    ...launchOptions,
    executablePath: launchOptions.executablePath || 'Auto-Detect'
  }, null, 2));

  let browser;
  try {
    console.log('🚀 [LAUNCH] Booting Omni-Fix Browser Instance...');
    browser = await puppeteer.launch(launchOptions);
    console.log('✅ [LAUNCH] Connection established.');
  } catch (launchError) {
    console.error('💥 [FATAL] Exit Code 100 Root Cause:');
    console.error(launchError);
    process.exit(100); // Explicitly exit with 100 if launch fails to help debugging
  }
  
  try {
    const page = await browser.newPage();
    const androidUA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36';
    await page.setUserAgent(androidUA);

    if (rawCookies && rawCookies.length > 10) {
      try {
        const cookies = JSON.parse(rawCookies);
        await page.setCookie(...cookies.map(c => ({
          ...c, 
          domain: c.domain || '.google.com',
          secure: true,
          sameSite: 'Lax'
        })));
        console.log('🍪 [AUTH] Identity Vault Linked.');
      } catch (e) {
        console.warn('⚠️ [AUTH] Cookie injection bypassed due to parsing error.');
      }
    }

    console.log('🌐 [NAVIGATE] Establishing link to: ' + url);
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 120000 
    });
    
    console.log('⏳ [STABILIZE] Deep asset synchronization (35s)...');
    await delay(35000); 

    const bundleData = await page.evaluate(() => {
      return {
        html: document.body.innerHTML,
        head: document.head.innerHTML,
        origin: window.location.origin,
        cookies: document.cookie
      };
    });

    const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <base href="${bundleData.origin}/">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
  <title>OmniFix AI Native</title>
  ${bundleData.head}
  <script>
    (function() {
      try {
        const cookies = ${JSON.stringify(bundleData.cookies)};
        if (cookies) {
          cookies.split(';').forEach(c => {
            document.cookie = c.trim() + "; domain=.google.com; path=/; SameSite=Lax";
          });
        }
      } catch(e) {}
      window.isNativeApp = true;
    })();
  </script>
  <style>
    body { background: #000 !important; color: #fff !important; margin: 0; padding: 0; overflow-x: hidden; }
    #forge-container { width: 100vw; height: 100vh; overflow-y: auto; -webkit-overflow-scrolling: touch; }
    ::-webkit-scrollbar { display: none; }
  </style>
</head>
<body class="omnifix-v15-2">
  <div id="forge-container">${bundleData.html}</div>
</body>
</html>`;

    const outDir = path.resolve('www');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), finalHtml);
    console.log('✅ [OMNIFIX] Interface Forge Successful.');
  } catch (err) {
    console.error('❌ [FATAL] Omni-Fix Sequence Broken:', err.message);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
  }
}
omniFixScrape();