// Browser walkthrough with fake motion data. Needs Playwright and a local server:
//   npx http-server -c-1 -p 8080 . &   then   node tests/e2e.mjs [outDir]
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const OUT = process.argv[2] || 'test-shots';
const exe = process.env.CHROMIUM_PATH;

const browser = await chromium.launch(exe ? { executablePath: exe } : {});

// Sends deviceorientation events at ~60 Hz for `ms` milliseconds.
async function hold(page, beta, gamma, ms) {
  await page.evaluate(async ([beta, gamma, ms]) => {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 0, beta, gamma }));
      await new Promise((r) => setTimeout(r, 16));
    }
  }, [beta, gamma, ms]);
}
const UPRIGHT = [0, 90];   // sideways, screen vertical
const NOD_DOWN = [180, 30]; // screen toward the floor
const TILT_BACK = [0, 30];  // screen toward the ceiling

async function landscapeRound() {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.screenshot({ path: `${OUT}/1-home.png` });

  // Make a three-card deck in the editor.
  await page.click('#new-deck');
  await page.fill('#editor-name', 'Three Cards');
  await page.fill('#editor-cards', 'Alpha\nBravo\nCharlie\nbravo\n');
  assert.equal(await page.textContent('#editor-count'), '4 cards');
  await page.click('#editor-save');
  assert.equal(await page.textContent('#deck-name'), 'Three Cards');
  assert.match(await page.textContent('#deck-meta'), /^3 cards/);
  await page.screenshot({ path: `${OUT}/2-deck.png` });

  await page.click('#play');
  await hold(page, ...UPRIGHT, 300);
  assert.equal(await page.getAttribute('#stage', 'data-view'), 'ready');
  await page.screenshot({ path: `${OUT}/3-ready.png` });
  await hold(page, ...UPRIGHT, 3800); // steady -> countdown -> play
  assert.equal(await page.getAttribute('#stage', 'data-view'), 'play');
  await page.screenshot({ path: `${OUT}/4-card.png` });
  const first = await page.textContent('#card');

  await hold(page, ...NOD_DOWN, 250);
  assert.equal(await page.getAttribute('#feedback', 'class'), 'feedback correct');
  await page.screenshot({ path: `${OUT}/5-correct.png` });
  await hold(page, ...NOD_DOWN, 600); // still down: same card, no new answer
  assert.equal(await page.getAttribute('#feedback', 'class'), 'feedback correct');
  await hold(page, ...UPRIGHT, 600);
  const second = await page.textContent('#card');
  assert.notEqual(second, first);

  await hold(page, ...TILT_BACK, 250);
  assert.equal(await page.getAttribute('#feedback', 'class'), 'feedback pass');
  await page.screenshot({ path: `${OUT}/6-pass.png` });
  await hold(page, ...UPRIGHT, 600);
  await hold(page, ...NOD_DOWN, 250);
  await hold(page, ...UPRIGHT, 600);
  assert.equal(await page.getAttribute('#stage', 'data-view'), 'timeup');
  assert.equal(await page.textContent('#timeup-text'), 'Deck done!');
  await page.waitForSelector('[data-screen="results"]:not([hidden])', { timeout: 3000 });
  assert.equal(await page.textContent('#result-score'), '2');
  assert.equal(await page.locator('#result-list li').count(), 3);
  assert.equal(await page.locator('#result-list li.pass').count(), 1);
  await page.screenshot({ path: `${OUT}/7-results.png`, fullPage: true });

  // Share link round trip into a fresh browser.
  const url = await page.evaluate(async () => {
    const { shareUrl, listDecks } = await import('./js/decks.js');
    return shareUrl(listDecks().find((d) => d.name === 'Three Cards'));
  });
  const other = await browser.newPage();
  other.on('dialog', (d) => d.accept());
  await other.goto(url);
  assert.equal(await other.textContent('#deck-name'), 'Three Cards');
  await other.close();

  assert.deepEqual(errors, []);
  await page.close();
}

async function portraitLockedRound() {
  // Rotation lock on: page stays portrait while the phone is held sideways.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.goto(BASE);
  await page.click('.deck-item');
  await page.click('#play');
  await hold(page, 90, 0, 300); // phone upright in portrait
  assert.equal(await page.textContent('#ready-title'), 'Turn your phone sideways');
  await page.screenshot({ path: `${OUT}/8-portrait-turn.png` });
  await hold(page, ...UPRIGHT, 3800);
  assert.equal(await page.getAttribute('#stage', 'data-view'), 'play');
  assert.match(await page.getAttribute('#stage', 'class'), /rot-c?cw/);
  await page.screenshot({ path: `${OUT}/9-portrait-rotated.png` });
  await page.click('#quit');
  assert.equal(await page.isVisible('#play'), true);
  await page.close();
}

async function noSensorRound() {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await page.goto(BASE);
  await page.click('.deck-item');
  await page.click('#play');
  await page.waitForSelector('#tap-start:not([hidden])', { timeout: 3000 });
  await page.screenshot({ path: `${OUT}/10-tap-mode.png` });
  await page.click('#tap-start');
  await page.waitForSelector('.play-view', { state: 'visible', timeout: 4000 });
  await page.click('#tap-correct');
  await page.waitForTimeout(600);
  await page.click('#tap-pass');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/11-tap-play.png` });
  await page.click('#quit');
  await page.close();
}

try {
  await landscapeRound();
  console.log('ok landscape round');
  await portraitLockedRound();
  console.log('ok portrait with rotation lock');
  await noSensorRound();
  console.log('ok no-sensor tap mode');
} finally {
  await browser.close();
}
