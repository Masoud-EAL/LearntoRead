#!/usr/bin/env node
/* Take a picture of each game's first question, for its start page and for the
   preview a shared link shows (og:image). Run after adding a game or changing
   how one looks, then re-run build-links.py so the pages pick the pictures up:

     node tools/build-shots.js            # every game page, guide page and main page
     node tools/build-shots.js clock shop # just these slugs

   A guide page (tools/guide-pages.json) gets a picture of the page its Play
   button opens. The home and game screens get one each under the names in
   MAIN, for the share previews of index.html, about.html and game.html.

   Playwright is found the same way tools/checks/check.js finds it. The pictures
   are 1200x630, the size link previews expect, saved as JPEG to keep the
   repo small. */
const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'shots');

function loadPlaywright() {
  const tries = ['playwright', '/opt/node22/lib/node_modules/playwright'];
  for (const t of tries) { try { return require(t); } catch (e) {} }
  throw new Error('Playwright not found: npm install -g playwright');
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

function serve() {
  const server = http.createServer((req, res) => {
    let file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

const MAIN = [{ slug: 'home', dest: 'index.html' }, { slug: 'game', dest: 'game.html' }];

// A guide or main page: the screen as it opens. On the tracing pages the mode
// and language menus are hidden for the picture, so it shows the title and
// the letter being traced rather than the menus between them.
async function shootScreen(browser, base, g) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    try { localStorage.setItem('musicOn', '0'); localStorage.setItem('wl_trace_name', 'Fatima'); } catch (e) {}
  });
  await page.goto(base + '/' + g.dest, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: '#modeTabs,.lang-row,#nameSetup{display:none!important}' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, g.slug + '.jpg'), type: 'jpeg', quality: 78 });
  console.log('  ' + g.slug);
  await page.close();
}

(async () => {
  const pages = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'game-pages.json'), 'utf8')).games;
  const guides = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'guide-pages.json'), 'utf8')).guides;
  const only = process.argv.slice(2);
  const todo = pages.filter(g => !only.length || only.includes(g.slug));
  const screens = guides.concat(MAIN).filter(g => !only.length || only.includes(g.slug));
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port;
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  for (const g of todo) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    // Music off, so nothing is waiting on audio; the dice game has no first
    // question, so its picture is its own start screen.
    await page.addInitScript(() => { try { localStorage.setItem('musicOn', '0'); } catch (e) {} });
    const play = g.game === 'target' ? '' : '&play=1';
    await page.goto(base + '/game.html?mode=solo&q=10&game=' + encodeURIComponent(g.game) + play,
                    { waitUntil: 'domcontentloaded' });
    try {
      await page.waitForFunction(() => {
        const s = document.querySelector('.screen.active');
        return s && s.id !== 'screen-home' && s.id !== 'screen-solo-setup';
      }, null, { timeout: 15000 });
    } catch (e) { console.log('  x ' + g.slug + ': no question'); await page.close(); continue; }
    // Headless Chromium will not start audio without a tap, so Play here waits
    // on the start screen, as it would on an iPhone. Press it for the picture.
    if (play) await page.evaluate(() => {
      if (document.querySelector('#screen-solo-launch.active')) startSoloGame();
    });
    await page.waitForTimeout(900);
    // The countdown is part of the game, but a picture caught mid-countdown
    // looks like a game already running out of time.
    await page.evaluate(() => { try { clearInterval(studentTimerInt); } catch (e) {} });
    await page.screenshot({ path: path.join(OUT, g.slug + '.jpg'), type: 'jpeg', quality: 78 });
    console.log('  ' + g.slug);
    await page.close();
  }
  for (const g of screens) await shootScreen(browser, base, g);
  await browser.close();
  server.close();
})();
