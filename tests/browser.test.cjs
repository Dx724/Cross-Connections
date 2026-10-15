const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const catalog = require('../game.js');

(async () => {
  const server = http.createServer((req, res) => {
    const name = req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0].slice(1);
    if (!['index.html', 'app.js', 'game.js', 'style.css'].includes(name)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(path.join(__dirname, '..', name)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = process.env.SITE_URL || `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.goto(origin);
    await page.waitForSelector('#board .tile');
    assert.equal(await page.locator('#tries').textContent(), '9 mistakes left');
    assert.equal(await page.locator('#dots i').count(), 9);
    assert.equal(await page.locator('#board .tile').count(), 16);
    assert.equal(await page.locator('#check-history li').count(), 0);
    assert.equal(await page.locator('#edition').textContent(), 'No. 003');
    assert.equal(await page.evaluate(() => activePuzzle.id), '004');
    assert.equal(await page.locator('#edition').getAttribute('aria-live'), 'polite');
    assert(await page.getByRole('button', { name: 'Next puzzle', exact: true }).isDisabled());
    await page.evaluate(() => localStorage.setItem('cross-connections-003-lines-v2', 'preserve retired progress'));
    for (const id of ['002', '001']) {
      await page.getByRole('button', { name: 'Previous puzzle', exact: true }).click();
      assert.equal(await page.locator('#edition').textContent(), `No. ${id}`);
    }
    assert(await page.getByRole('button', { name: 'Previous puzzle', exact: true }).isDisabled());
    for (const id of ['002', '003']) {
      await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
      assert.equal(await page.locator('#edition').textContent(), `No. ${id}`);
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('cross-connections-003-lines-v2')), 'preserve retired progress');

    await page.evaluate(() => {
      state.board = activePuzzle.words.slice();
      [state.board[0], state.board[5]] = [state.board[5], state.board[0]];
      render();
    });
    await page.getByRole('button', { name: 'Row 1, select to check', exact: true }).click();
    await page.getByRole('button', { name: 'Check selection', exact: false }).click();
    assert.match(await page.locator('#feedback').textContent(), /^One away\. 3 of 4 words match a group\. 8 mistakes remaining\./);
    assert.equal(await page.locator('#check-history li').count(), 1);
    assert.equal(await page.locator('.history-result').textContent(), 'One away');
    const firstHistory = await page.locator('#check-history').textContent();
    const saved004 = await page.evaluate(() => localStorage.getItem('cross-connections-004-lines-v2'));
    await page.reload();
    assert.equal(await page.locator('#edition').textContent(), 'No. 003');
    assert.equal(await page.evaluate(() => localStorage.getItem('cross-connections-004-lines-v2')), saved004);
    assert.equal(await page.evaluate(() => localStorage.getItem('cross-connections-003-lines-v2')), 'preserve retired progress');
    assert.equal(await page.locator('#check-history').textContent(), firstHistory);
    assert.equal(await page.locator('#tries').textContent(), '8 mistakes left');
    await page.getByRole('button', { name: 'Previous puzzle', exact: true }).click();
    assert.equal(await page.locator('#check-history li').count(), 0);
    await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
    assert.equal(await page.locator('#check-history').textContent(), firstHistory);
    await page.getByRole('button', { name: 'Row 1, select to check', exact: true }).click();
    await page.getByRole('button', { name: 'Check selection', exact: false }).click();
    assert.equal(await page.locator('#check-history li').count(), 1);
    assert.equal(await page.locator('#tries').textContent(), '8 mistakes left');
    assert.equal(await page.locator('#feedback').textContent(), 'Already checked. One away. No mistake used.');
    // Move the repeated set to another row, then a column, with its order changed.
    const setLine = async (indices, axis = 'row', index = 0) => {
      await page.evaluate(({ indices, axis, index }) => {
        const chosen = indices.map(i => activePuzzle.words[i]);
        const remainder = activePuzzle.words.filter(word => !chosen.includes(word));
        const positions = lineIndices(axis, index);
        state.board = Array.from({ length: 16 }, (_, i) => positions.includes(i) ? chosen[positions.indexOf(i)] : remainder.shift());
        selection = null;
        render();
      }, { indices, axis, index });
      await page.getByRole('button', { name: `${axis === 'row' ? 'Row' : 'Column'} ${index + 1}, select to check`, exact: true }).click();
    };
    for (const axis of ['row', 'col']) {
      await setLine([2, 5, 1, 3], axis, 2);
      await page.getByRole('button', { name: 'Check selection', exact: false }).click();
      assert.equal(await page.locator('#feedback').textContent(), 'Already checked. One away. No mistake used.');
      assert.equal(await page.locator('#tries').textContent(), '8 mistakes left');
      assert.equal(await page.locator('#check-history li').count(), 1);
    }
    await page.reload();
    await page.getByRole('button', { name: 'Column 3, select to check', exact: true }).click();
    await page.getByRole('button', { name: 'Check selection', exact: false }).dblclick();
    assert.equal(await page.locator('#feedback').textContent(), 'Already checked. One away. No mistake used.');
    assert.equal(await page.locator('#tries').textContent(), '8 mistakes left');
    assert.equal(await page.locator('#check-history').textContent(), firstHistory);
    // The corresponding set on a different puzzle is a first guess there.
    await page.getByRole('button', { name: 'Previous puzzle', exact: true }).click();
    await setLine([5, 1, 2, 3]);
    await page.getByRole('button', { name: 'Check selection', exact: false }).click();
    assert.match(await page.locator('#feedback').textContent(), /^One away\./);
    assert.equal(await page.locator('#tries').textContent(), '8 mistakes left');
    const otherHistory = await page.locator('#check-history').textContent();
    await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
    await setLine([0, 1, 6, 7]);
    await page.getByRole('button', { name: 'Check selection', exact: false }).click();
    assert.match(await page.locator('#feedback').textContent(), /^Two away\. 2 of 4 words match a group\./);
    assert.equal(await page.locator('#check-history li').count(), 2);
    assert.deepEqual(await page.locator('.history-result').allTextContents(), ['One away', 'Two away']);
    await page.getByRole('button', { name: 'Check selection', exact: false }).click();
    assert.equal(await page.locator('#feedback').textContent(), 'Already checked. Two away. No mistake used.');
    assert.equal(await page.locator('#tries').textContent(), '7 mistakes left');
    await setLine([0, 5, 10, 15]);
    await page.getByRole('button', { name: 'Check selection', exact: false }).click();
    assert.deepEqual(await page.locator('.history-result').allTextContents(), ['One away', 'Two away', 'Three away']);
    await page.getByRole('button', { name: 'Check selection', exact: false }).click();
    assert.equal(await page.locator('#feedback').textContent(), 'Already checked. Three away. No mistake used.');
    assert.equal(await page.locator('#tries').textContent(), '6 mistakes left');
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 980 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Horizontal overflow at ${width}px`);
      assert(await page.locator('#check-history').isVisible());
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `cross-connections-feedback-${width}.png`), fullPage: true });
    }
    await page.getByRole('button', { name: 'How to play', exact: true }).click();
    assert(await page.locator('#rules').isVisible());
    assert.match(await page.locator('#rules').textContent(), /Nine mistakes ends the game/);
    await page.getByRole('button', { name: "Let's play", exact: true }).click();
    assert(!await page.locator('#rules').isVisible());
    for (let attempt = 4; attempt <= 9; attempt++) {
      await setLine([0, 1, 2, attempt]);
      await page.getByRole('button', { name: 'Check selection', exact: false }).click();
    }
    assert.equal(await page.locator('#check-history li').count(), 9);
    assert.equal(await page.locator('#tries').textContent(), '0 mistakes left');
    assert(await page.getByRole('button', { name: 'Play again', exact: true }).isVisible());
    await page.reload();
    assert(await page.getByRole('button', { name: 'Play again', exact: true }).isVisible());
    assert.equal(await page.locator('#check-history li').count(), 9);
    await page.getByRole('button', { name: 'Play again', exact: true }).click();
    assert.equal(await page.locator('#tries').textContent(), '9 mistakes left');
    assert.equal(await page.locator('#check-history li').count(), 0);
    assert(await page.locator('#history-empty').isVisible());
    await setLine([3, 2, 1, 5], 'col', 2);
    await page.getByRole('button', { name: 'Check selection', exact: false }).click();
    assert.match(await page.locator('#feedback').textContent(), /^One away\./);
    assert.equal(await page.locator('#tries').textContent(), '8 mistakes left');
    await page.getByRole('button', { name: 'Previous puzzle', exact: true }).click();
    assert.equal(await page.locator('#check-history').textContent(), otherHistory);
    await page.getByRole('button', { name: 'Next puzzle', exact: true }).click();
    await setLine([0, 1, 2, 3]);
    await page.getByRole('button', { name: 'Check selection', exact: false }).click();
    assert.equal(await page.locator('.line-arrow.locked').count(), 1);
    assert.equal(await page.locator('#check-history li').count(), 1);
    assert.equal(await page.locator('#tries').textContent(), '8 mistakes left');
    // Preserve a real old four-mistake loss and an existing correct row when migrating.
    const latest = catalog.create(catalog.puzzles.at(-1));
    const legacy = { board: latest.words.slice(), mistakes: 4, status: 'lost', orientation: 'families', locks: { row: [latest.group(latest.words, 'row', 0), null, null, null], col: [null, null, null, null] } };
    await page.evaluate(({ id, legacy }) => localStorage.setItem(`cross-connections-${id}-lines-v2`, JSON.stringify(legacy)), { id: latest.id, legacy });
    await page.reload();
    assert.equal(await page.locator('#tries').textContent(), '5 mistakes left');
    assert.equal(await page.locator('.line-arrow.locked').count(), 1);
    assert.deepEqual(await page.locator('#board .tile').allTextContents(), legacy.board);
    assert.equal(await page.locator('#check-history li').count(), 0);
    assert.equal(await page.locator('#instruction').textContent(), '1 of 8 groups correct');
    assert.deepEqual(errors, []);
    console.log('Browser QA passed: nine distinct attempts, free reordered row/column repeats, compact One away/Two away/Three away history, reload/navigation persistence, loss/replay, legacy migration, help dialog, 320/390/768/1280px layouts, and no JavaScript errors.');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
