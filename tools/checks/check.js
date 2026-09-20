#!/usr/bin/env node
/* WordLink checks: one file, one entry point, several subcommands.

   These grew out of bug reports. Almost every report turned out to be one
   visible case of a rule that was wrong in more places than the reporter
   happened to hit: the charger icon was wrong in two banks, the "hear it
   again" button was missing from twelve, "why did I get five Copy It
   questions" was the question picker's model of a step disagreeing with what
   the round actually credits. Fixing only the reported instance would have
   left every sibling live. So each check below is the sweep for one class of
   fault, and the table in README.md names the report that earned it.

       node tools/checks/check.js                  everything
       node tools/checks/check.js audio repeats    just those
       node tools/checks/check.js probe oddone 20  print real questions

   Exit code 0 means every check passed.

   No npm install: the app has no package.json and Pages publishes the repo as
   it stands, so adding a dependency here would be the first one. Playwright is
   resolved from wherever it already lives, the repo is served by Node's own
   http module, and the browser is launched with plain chromium.launch() so a
   Playwright upgrade that moves the browser directory does not break us. */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

/* ---------------------------------------------------------------- plumbing */

function loadPlaywright() {
  const tries = ['playwright'];
  // Where a global npm install puts it. Not hardcoded as the only answer:
  // require('playwright') wins whenever the repo has its own copy.
  for (const dir of ['/opt/node22/lib/node_modules', '/usr/local/lib/node_modules',
                     '/usr/lib/node_modules']) {
    tries.push(path.join(dir, 'playwright'));
  }
  if (process.env.NODE_PATH) {
    process.env.NODE_PATH.split(path.delimiter).filter(Boolean)
      .forEach(d => tries.push(path.join(d, 'playwright')));
  }
  for (const t of tries) {
    try { return require(t); } catch (e) { /* keep looking */ }
  }
  console.error('Cannot find Playwright. Install it where node can see it:\n' +
                '    npm install -g playwright\n' +
                'or point NODE_PATH at an existing install:\n' +
                '    NODE_PATH=/opt/node22/lib/node_modules node tools/checks/check.js');
  process.exit(2);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf'
};

/* Serve the repo as Pages would. Port 0 so several runs can overlap. */
function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve({
      base: 'http://127.0.0.1:' + server.address().port,
      close: () => new Promise(r => server.close(r))
    }));
  });
}

/* One loaded copy of the app, with its console and page errors collected.
   `game` only decides which launch screen we land on; every check below works
   through the app's own functions, so any game will do. */
async function openApp(browser, base, game) {
  const page = await browser.newPage({ viewport: { width: 420, height: 860 } });
  const errs = [];
  page.on('pageerror', e => errs.push('page error: ' + e.message));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource|net::/.test(t)) {
      errs.push('console error: ' + t);
    }
  });
  await page.goto(base + '/game.html?mode=solo&game=' + (game || 'signs'),
                  { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof ACSF_POOL !== 'undefined', null, { timeout: 15000 });
  await page.waitForTimeout(300);
  page.errs = errs;
  return page;
}

/* Output. Checks call say() to narrate and bad() to fail. */
let PROBLEMS = [];
const say = (...a) => console.log(...a);
const bad = m => PROBLEMS.push(m);

/* ------------------------------------------------------------- the drivers */

/* Play a whole level check inside the page, answering every question a chosen
   way, and hand back whatever the caller's `report` function pulls out of the
   finished evidence. The app is driven through its own round functions rather
   than through clicks: a robot dragging a clock hand tests the robot, not the
   assessment. `boot` and `run` do use the real UI. */
const PLAY = function (how, reportSrc, mode) {
  soloMode = (mode || 'solo') === 'solo'; myScore = 0;
  TEST = newTestGame(mode || 'solo', 'test:level');
  const seen = [], perStep = {};
  let guard = 0;
  while (!testFinished() && guard++ < 90) {
    testStartRound();
    const qs = (soloQuestions || []).slice();
    if (!qs.length) break;
    TEST.tally = []; TEST.roundPts = 0;
    qs.forEach(function (q, i) {
      soloQIdx = i; currentStudentQ = q;
      const st = (TEST.roundSteps || [])[i] || {};
      perStep[st.type || '?'] = (perStep[st.type || '?'] || 0) + 1;
      seen.push({ q: q, step: st });
      let a;
      if (how === 'blank') a = '';
      else if (how === 'wrong') a = 'zzzz';
      else {
        a = q.answer;
        // An open question's q.answer can be the "no goal yet" option, which
        // is a decline, not a real answer. Pick something a learner would say.
        if (isOpenQ(q)) {
          a = (q.choices || []).find(c => (q.declines || []).indexOf(c) < 0) || q.answer;
        }
        // Write Two Sentences marks the model down when it is handed back, so
        // q.answer is the one answer a learner who did the task would not
        // give. A perfect run has to adapt it the way the round asks: two
        // sentences, each opening with a capital and carrying the one a name
        // or a country takes.
        if (q.freeText) a = 'My name is Ali. I am from Iraq.';
        // Right letters, no capitals, no spaces: the copy a learner at Stage A
        // makes. Only touches typed rounds; tapped ones keep the exact option.
        if (how === 'sloppy' && q.type === 'typein' && !q.anyAnswer) {
          a = String(a).toLowerCase().replace(/ /g, '');
        }
      }
      const tier = how === 'blank' ? 'wrong' : answerTier(q, a);
      testRecord(tier, tier === 'correct' ? 10 : 0, false, a);
    });
    testEndRound();
    TEST.round++;
  }
  const prof = acsfProfile(TEST.ev, true);
  return (new Function('ev', 'prof', 'seen', 'perStep', 'return (' + reportSrc + ')(ev,prof,seen,perStep)'))
    (TEST.ev, prof, seen, perStep);
};

/* Run PLAY inside the page. `report` is a function serialised as source, so it
   runs in the page too and can reach the app's own helpers. */
function play(page, how, report, mode) {
  return page.evaluate(([playSrc, how, reportSrc, mode]) => {
    return (new Function('return (' + playSrc + ')'))()(how, reportSrc, mode);
  }, [PLAY.toString(), how, report.toString(), mode || 'solo']);
}

/* --------------------------------------------------------------- the checks */

const CHECKS = {};
const check = (name, blurb, fn) => { CHECKS[name] = { blurb, fn }; };

check('boot', 'game.html loads with no page or console errors', async ctx => {
  for (const url of ['/game.html?mode=solo&game=signs',
                     '/game.html?mode=solo&game=test:level',
                     '/index.html', '/all-games.html']) {
    const page = await ctx.browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => {
      if (m.type() === 'error' && !/ERR_TUNNEL|Failed to load resource|net::/.test(m.text())) {
        errs.push(m.text());
      }
    });
    await page.goto(ctx.base + url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    say('  ' + (errs.length ? 'x ' : '  ') + url + (errs.length ? '  ' + errs[0] : ''));
    errs.forEach(e => bad(url + ': ' + e));
    await page.close();
  }
});

check('integrity', 'every pool step and ladder rung deals, claims and has a skill', async ctx => {
  const out = await ctx.page.evaluate(() => {
    const bad = [];
    const known = t => isGenBank(t) || isPhonicsType(t) || poolFor(t).length > 0;
    let rungs = 0;
    Object.keys(TEST_LADDERS).forEach(function (sec) {
      TEST_LADDERS[sec].forEach(function (step, i) {
        rungs++;
        if (!known(step.type)) bad.push('ladder ' + sec + '[' + i + '] unknown type ' + step.type);
        let qs = [];
        try { qs = testQuestions(step, 3); }
        catch (e) { bad.push('ladder ' + sec + '[' + i + '] threw ' + e.message); return; }
        if (qs.length < 3) bad.push('ladder ' + sec + '[' + i + '] dealt only ' + qs.length + ' of 3');
      });
    });
    ACSF_POOL.forEach(function (st, i) {
      if (!known(st.type)) bad.push('pool[' + i + '] unknown type ' + st.type);
      let qs = [];
      try { qs = testQuestions(st, 1); }
      catch (e) { bad.push('pool[' + i + '] ' + st.type + ' threw ' + e.message); return; }
      if (!qs.length) bad.push('pool[' + i + '] ' + st.type + ' dealt nothing');
      if (!GAME_INFO[st.type] || !GAME_INFO[st.type].skill) bad.push('no skill named for ' + st.type);
      if (!acsfClaimsFor(st).length) bad.push('pool[' + i + '] ' + st.type + ' claims no feature');
    });
    // Every indicator the staircase walks needs a first stage the pool can ask,
    // or the learner is judged on a question never put to them.
    acsfWalked().forEach(function (ind) {
      if (!acsfFirstStage(ind)) bad.push('.' + ind + ' is walked but has no askable first stage');
    });
    BANK_SECTIONS.map(s => 'test:' + s.id).forEach(function (v) {
      const lad = ladderFor(v);
      if (!lad || !lad.length) bad.push('no ladder for ' + v);
    });
    const cov = {};
    ACSF_POOL.forEach(st => acsfClaimsFor(st).forEach(c => { cov[c[0] + '|' + c[1]] = 1; }));
    return { bad: bad, pool: ACSF_POOL.length, rungs: rungs, stages: Object.keys(cov).length };
  });
  say('  ' + out.pool + ' pool steps, ' + out.rungs + ' ladder rungs, ' +
      out.stages + ' stages the pool can ask');
  out.bad.forEach(bad);
});

check('run', 'the level check finishes through the real UI, four ways', async ctx => {
  for (const how of ['right', 'wrong', 'sloppy', 'timeout']) {
    const page = await openApp(ctx.browser, ctx.base, 'test:level');
    await page.click('.launch-begin');
    await page.waitForTimeout(300);
    let guard = 0, rounds = 0;
    while (guard++ < 500) {
      const st = await page.evaluate(() => {
        const on = [...document.querySelectorAll('.screen.active')].map(s => s.id);
        const rd = document.getElementById('screen-test-round');
        return { screen: on[0] || null, state: rd ? rd.dataset.state : null };
      });
      if (st.screen === 'screen-test-round') {
        if (st.state !== 'round') break;
        rounds++;
        await page.click('#screen-test-round .round-only button');
        await page.waitForTimeout(150);
        continue;
      }
      if (st.screen === 'screen-student-result') {
        await page.click('#solo-next-wrap button, #solo-next-wrap .btn');
        await page.waitForTimeout(120);
        continue;
      }
      if (st.screen === 'screen-student-answer') {
        if (how === 'timeout') {
          await page.evaluate(() => { if (!answered) submitAnswer(true); });
        } else {
          await page.evaluate(h => {
            const q = currentStudentQ;
            let a = h === 'wrong' ? 'zzzz' : q.answer;
            if (h === 'sloppy' && q.type === 'typein' && !q.anyAnswer) {
              a = String(a).toLowerCase().replace(/ /g, '');
            }
            answered = true; clearInterval(studentTimerInt);
            showSoloResult(a, q.answer, 10, false);
          }, how);
        }
        await page.waitForTimeout(110);
        continue;
      }
      await page.waitForTimeout(110);
    }
    const fin = await page.evaluate(() => {
      openAcsfPanel();
      return {
        asked: TEST.ev.asked,
        withEvidence: Object.keys(TEST.ev.byInd).length,
        walked: acsfWalked().length,
        panel: [...document.querySelectorAll('.screen.active')].map(s => s.id)[0],
        copy: acsfCopyText(acsfShown).length
      };
    });
    say('  ' + how.padEnd(8) + fin.asked + ' questions, evidence for ' +
        fin.withEvidence + ' of ' + fin.walked + ' indicators, report ' + fin.copy + ' chars');
    if (!fin.asked) bad('run ' + how + ': no questions were asked');
    if (fin.withEvidence < fin.walked) {
      bad('run ' + how + ': only ' + fin.withEvidence + ' of ' + fin.walked +
          ' indicators ended with any evidence');
    }
    if (fin.panel !== 'screen-test-acsf') bad('run ' + how + ': the teacher panel did not open');
    if (fin.copy < 200) bad('run ' + how + ': the copyable report is only ' + fin.copy + ' chars');
    page.errs.forEach(e => bad('run ' + how + ': ' + e));
    await page.close();
  }
});

check('evidence', 'the panel prints every question asked and the answer given to it', async ctx => {
  const page = await openApp(ctx.browser, ctx.base, 'test:level');
  await page.click('.launch-begin');
  await page.waitForTimeout(300);
  // Answered three ways in turn, so the list has a right answer, a wrong one
  // and an untouched question in it. Through the real UI, because what the
  // list prints is what was on the screen and only the UI puts it there.
  await page.evaluate(() => { window.__gave = []; });
  let guard = 0, n = 0;
  while (guard++ < 500) {
    const st = await page.evaluate(() => {
      const on = [...document.querySelectorAll('.screen.active')].map(s => s.id);
      const rd = document.getElementById('screen-test-round');
      return { screen: on[0] || null, state: rd ? rd.dataset.state : null };
    });
    if (st.screen === 'screen-test-round') {
      if (st.state !== 'round') break;
      await page.click('#screen-test-round .round-only button');
      await page.waitForTimeout(140);
      continue;
    }
    if (st.screen === 'screen-student-result') {
      await page.click('#solo-next-wrap button, #solo-next-wrap .btn');
      await page.waitForTimeout(110);
      continue;
    }
    if (st.screen === 'screen-student-answer') {
      const how = ['right', 'wrong', 'blank', 'timeout'][n++ % 4];
      await page.evaluate(h => {
        const q = currentStudentQ;
        const a = (h === 'blank' || h === 'timeout') ? '' : h === 'wrong' ? 'zzzz'
          : (q.freeText ? 'My name is Ali. I am from Iraq.' : String(q.answer));
        window.__gave.push(a);
        answered = true; clearInterval(studentTimerInt);
        // Pressing Submit over an untouched question and letting the clock run
        // out are the same empty answer and different things to read, so the
        // list has to tell them apart.
        showSoloResult(a, q.answer, 10, h === 'timeout');
      }, how);
      await page.waitForTimeout(100);
      continue;
    }
    await page.waitForTimeout(100);
  }
  const out = await page.evaluate(() => {
    const ev = TEST.ev;
    openAcsfPanel();
    const box = document.getElementById('acsf-evidence');
    const btn = document.getElementById('acsf-ev-btn');
    const shut = { hidden: box.hidden, blocks: box.querySelectorAll('.acsf-q').length,
                   copy: acsfCopyText(acsfShown, acsfEvidenceOn ? acsfShownEv : null) };
    toggleAcsfEvidence();
    const open = { hidden: box.hidden, shown: getComputedStyle(box).display,
                   blocks: box.querySelectorAll('.acsf-q').length,
                   copy: acsfCopyText(acsfShown, acsfEvidenceOn ? acsfShownEv : null) };
    // A feature the list prints under a question has to be one the profile
    // counted. Anything else is working the app never did, printed on a page a
    // teacher may act on.
    const loose = [], thin = [];
    (ev.qs || []).forEach(function (e, i) {
      if (!e.game || !e.ask) thin.push(i + 1 + ' ' + (e.game || '(no game)') + ': nothing to read');
      if (!e.feats.length) thin.push(i + 1 + ' ' + e.game + ': counted towards nothing');
      e.feats.forEach(function (f) {
        const w = ((ev.byInd[f.ind] || {})[f.lvl] || {}).why || {};
        if (!w[f.text]) loose.push(i + 1 + ' ' + e.game + ': .' + f.ind + ' ' + f.lvl + ' ' + f.text);
      });
    });
    // A teacher comes back to this page with the learner beside them, which
    // is the whole reason the run is kept on the device. The working has to
    // survive the reload with it.
    const kept = ((acsfLastRun() || {}).ev || {}).qs || [];
    return {
      asked: ev.asked, qs: (ev.qs || []).map(function (e) { return { ans: e.ans, how: e.how, game: e.game }; }),
      gave: window.__gave, shut: shut, open: open, loose: loose, thin: thin,
      kept: kept.length, btn: btn.textContent
    };
  });
  say('  ' + out.asked + ' questions asked, ' + out.qs.length + ' written down, ' +
      out.open.blocks + ' printed');
  if (out.qs.length !== out.asked) {
    bad('evidence: ' + out.asked + ' questions asked but ' + out.qs.length + ' written down');
  }
  if (out.qs.length !== out.gave.length) {
    bad('evidence: ' + out.gave.length + ' answers given but ' + out.qs.length + ' written down');
  }
  out.gave.forEach(function (a, i) {
    const e = out.qs[i];
    if (e && e.ans !== a.trim()) {
      bad('evidence: question ' + (i + 1) + ' was answered "' + a + '" and the list says "' + e.ans + '"');
    }
  });
  ['correct', 'wrong', 'blank', 'timeout'].forEach(function (h) {
    if (!out.qs.some(function (e) { return e.how === h; })) {
      bad('evidence: no question came out as ' + h + ', so that outcome is untested here');
    }
  });
  out.thin.forEach(x => bad('evidence: ' + x));
  out.loose.forEach(x => bad('evidence: a feature printed that the profile never counted: ' + x));
  if (out.kept !== out.qs.length) {
    bad('evidence: the run was saved with ' + out.kept + ' of its ' + out.qs.length +
        ' questions, so a teacher coming back to it loses the working');
  }
  if (!out.shut.hidden) bad('evidence: the questions are open before anyone asks for them');
  if (out.shut.copy.indexOf('THE QUESTIONS THIS RUN ASKED') >= 0) {
    bad('evidence: Copy carries the questions while they are hidden');
  }
  if (out.open.hidden || out.open.shown === 'none') bad('evidence: the button did not open the list');
  if (out.open.blocks !== out.qs.length) {
    bad('evidence: ' + out.qs.length + ' questions written down but ' + out.open.blocks + ' on the page');
  }
  if (out.open.copy.indexOf('THE QUESTIONS THIS RUN ASKED') < 0) {
    bad('evidence: Copy leaves the questions out while they are on the screen');
  }
  page.errs.forEach(e => bad('evidence: ' + e));
  await page.close();
});

/* Everything about the sheet that comes out of the printer. The panel is the
   one screen in this app meant to leave it, and a teacher printing from a
   phone got rows drawn on top of each other with the right-hand side cut off:
   the app is a fixed-height thing that scrolls inside itself, made of nested
   flex columns, and none of that survives being cut into pages. */
check('printable', 'the teacher panel prints as a document, not as an app', async ctx => {
  const page = await openApp(ctx.browser, ctx.base, 'test:level');
  // A synthetic run through the app's own round functions: this check is about
  // the page, not about the answering, and it needs a panel with both halves
  // on it. showStudentQuestion, because that is what puts a question on screen.
  await page.evaluate(() => {
    soloMode = true; myScore = 0; TEST = newTestGame('solo', 'test:level');
    let guard = 0;
    while (!testFinished() && guard++ < 40) {
      testStartRound();
      const qs = (soloQuestions || []).slice();
      TEST.tally = []; TEST.roundPts = 0;
      qs.forEach(function (q, i) {
        soloQIdx = i; currentStudentQ = q;
        showStudentQuestion(q, Date.now());
        const right = i % 3 !== 2;
        const a = right ? (q.freeText ? 'My name is Ali. I am from Iraq.' : q.answer) : 'zzzz';
        testRecord(right ? 'correct' : 'wrong', right ? 10 : 0, false, a);
      });
      testEndRound(); TEST.round++;
    }
    openAcsfPanel();
  });
  await page.emulateMedia({ media: 'print' });
  /* The sheet carries both halves whether or not the questions were opened on
     the screen first. It is the copy that gets filed and taken to the learner,
     and a teacher who presses Print without having scrolled has still asked
     for the report, not for half of it. */
  const shut = await page.evaluate(() => ({
    hidden: document.getElementById('acsf-evidence').hidden,
    list: getComputedStyle(document.getElementById('acsf-evidence')).display,
    blocks: document.querySelectorAll('#acsf-evidence .acsf-q').length,
    acts: getComputedStyle(document.querySelector('.acsf-acts')).display
  }));
  if (!shut.hidden) bad('printable: the questions are open on screen before anyone asks for them');
  if (shut.list === 'none') bad('printable: the questions do not print unless they were opened on screen first');
  if (!shut.blocks) bad('printable: there are no questions on the page to print');
  if (shut.acts !== 'none') bad('printable: the buttons print with the report');
  const out = await page.evaluate(() => {
    toggleAcsfEvidence();
    const panel = document.getElementById('screen-test-acsf');
    const bad = [];
    /* The chain the page is cut down. A printer needs one column as tall as it
       needs to be: anything on the way to it that is positioned, clipped, or
       held at the height of a phone screen either loses what will not fit or
       draws it over the next page. */
    let el = document.getElementById('acsf-evidence');
    while (el) {
      const c = getComputedStyle(el), nm = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
      if (c.position !== 'static') bad.push(nm + ' prints ' + c.position + ', not static');
      if (c.overflowX !== 'visible' || c.overflowY !== 'visible') bad.push(nm + ' clips what it prints (overflow ' + c.overflowX + '/' + c.overflowY + ')');
      if (c.transform !== 'none') bad.push(nm + ' prints under a transform');
      if (parseFloat(c.minHeight) > 0) bad.push(nm + ' prints with a min-height of ' + c.minHeight + ', which is the phone\'s');
      el = el.parentElement;
    }
    /* No tall flex box anywhere in what is printed. Safari does not fragment a
       flex container: where one crosses a page break it draws the remainder
       over the next page instead of continuing onto it. A flex row short
       enough to sit inside a block that never breaks cannot meet a page edge,
       so the rule is about the tall ones. */
    const PAGE = 600;
    panel.querySelectorAll('*').forEach(function (e) {
      const c = getComputedStyle(e);
      if (!/flex|grid/.test(c.display)) return;
      if (e.getBoundingClientRect().height <= PAGE) return;
      bad.push((e.id ? '#' + e.id : '.' + String(e.className).split(' ')[0]) +
               ' is a ' + c.display + ' box ' + Math.round(e.getBoundingClientRect().height) +
               'px tall, taller than a page');
    });
    // Nothing may be wider than the paper it is printed on.
    const over = [];
    panel.querySelectorAll('*').forEach(function (e) {
      if (e.getBoundingClientRect().width > document.body.clientWidth + 1) {
        over.push((e.className && String(e.className).split(' ')[0]) || e.tagName.toLowerCase());
      }
    });
    const ink = s => { const el = document.querySelector(s); return el ? getComputedStyle(el) : null; };
    const q = ink('.acsf-q'), nm = ink('.acsf-q-game'), row = ink('.acsf-row');
    return {
      bad: bad, over: over.slice(0, 4),
      list: getComputedStyle(document.getElementById('acsf-evidence')).display,
      qBg: q && q.backgroundColor, qInk: nm && nm.color, rowBg: row && row.backgroundColor,
      // An indicator and a question stay whole; a skill group is taller than a
      // sheet as often as not, and asking for that whole only buys white paper.
      keepRow: row && (row.breakInside || row.pageBreakInside),
      keepQ: q && (q.breakInside || q.pageBreakInside),
      keepGroup: ink('.acsf-group') && (ink('.acsf-group').breakInside || ink('.acsf-group').pageBreakInside),
      newPage: ink('.acsf-ev-head') && (ink('.acsf-ev-head').breakBefore || ink('.acsf-ev-head').pageBreakBefore)
    };
  });
  say('  ' + (out.bad.length ? 'x ' : '') + 'the printed page is one plain column' +
      (out.bad.length ? ': ' + out.bad[0] : ''));
  out.bad.forEach(x => bad('printable: ' + x));
  out.over.forEach(x => bad('printable: ' + x + ' is wider than the paper'));
  if (out.list === 'none') bad('printable: the questions stopped printing once they were shown');
  if (out.qBg !== 'rgb(255, 255, 255)') bad('printable: a question prints on ' + out.qBg + ', not white paper');
  if (out.rowBg !== 'rgb(255, 255, 255)') bad('printable: an indicator prints on ' + out.rowBg + ', not white paper');
  if (out.qInk !== 'rgb(0, 0, 0)') bad('printable: a question prints in ' + out.qInk + ', not black ink');
  if (out.keepRow !== 'avoid') bad('printable: an indicator may be split across two pages');
  if (out.keepQ !== 'avoid') bad('printable: a question may be split from its answer across two pages');
  if (out.keepGroup === 'avoid') bad('printable: a whole skill group is held together, which ends a page early');
  if (!/page|always/.test(out.newPage || '')) bad('printable: the questions do not start their own page');
  // And the pages themselves: real pagination, not an emulated one. A page
  // that comes out blank is content that was pushed off the sheet.
  const pdf = await page.pdf({ format: 'A4', printBackground: true,
                               margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  say('  ' + pages + ' pages of A4');
  if (pages < 2) bad('printable: the whole report came out on ' + pages + ' page');
  page.errs.forEach(e => bad('printable: ' + e));
  await page.close();
});

/* What is on the price tag has to be something that price would buy. Read the
   List has known this since it was written, capping its groceries at $20; Shop
   did not, and paid three dollars for shoes through every Stage A round the
   level check asks. */
check('prices', 'a shop round names something its price would buy', async ctx => {
  const out = await ctx.page.evaluate(() => {
    const bad = [], by = {};
    SHOP_ITEMS.forEach(it => { by[it.name] = it; });
    // Every round this bank can deal: paying and counting change, under $10
    // and over it, and the exact rounds the level check asks for by number.
    [['shop', 0], ['shop', 1], ['shop', 2],
     ['shopsmall', 0], ['shopsmall', 1], ['shopsmall', 2]].forEach(function (pair) {
      const qs = GEN_BANKS[pair[0]](40, pair[1]) || [];
      qs.forEach(function (q) {
        const it = by[q.item];
        if (!it) { bad.push(pair[0] + ' named "' + q.item + '", which is not a shop item'); return; }
        // The price on the tag, which for a change round is what the thing
        // cost and not the note that was handed over.
        const d = (q.mode === 'change' ? q.price : q.cents) / 100;
        if (d < it.low || d > it.high) {
          bad.push(pair[0] + ': ' + money(q.mode === 'change' ? q.price : q.cents) +
                   ' for ' + q.item + ', which costs $' + it.low + ' to $' + it.high);
        }
      });
    });
    /* And no gap anywhere the prices can land: every whole dollar and fifty
       cents from $1 to $100 has something that could cost it. A gap is not a
       wrong question today, it is the nearest fit quietly standing in for one,
       which is how "three dollars for shoes" reads in the first place. */
    const gaps = [];
    for (let c = 100; c <= 10000; c += 50) {
      if (!SHOP_ITEMS.some(it => c / 100 >= it.low && c / 100 <= it.high)) gaps.push(money(c));
    }
    return { bad: bad, gaps: gaps.slice(0, 6), items: SHOP_ITEMS.length };
  });
  say('  ' + out.items + ' items priced, 240 rounds dealt across both ranges');
  out.bad.slice(0, 8).forEach(x => bad('prices: ' + x));
  if (out.gaps.length) bad('prices: nothing in the shop costs ' + out.gaps.join(', '));
});

check('money', 'an amount is marked as an amount, however it is written', async ctx => {
  const out = await ctx.page.evaluate(() => {
    const bad = [], seen = [];
    // Marked the way the app marks it, through the app's own function.
    const mark = (q, typed) => answerTier(q, typed);
    /* Every way of writing one amount that a learner might reasonably write,
       and the ways that are a different amount. The reported bug is the first
       line of the first list: a $2 coin whose answer was "2.00" and whose box
       said "e.g. 2". */
    const forms = c => {
      const ok = [moneyAnswer(c), '$' + moneyAnswer(c)];
      const no = [];
      if (c % 100 === 0) {
        ok.push(String(c / 100), '$' + String(c / 100), (c / 100) + ' dollars');
      }
      if (c < 100) {
        const cc = (c < 10 ? '0' : '') + c;
        ok.push('0.' + cc, '.' + cc, c + 'c', c + ' cents');
      } else if (c % 100) {
        ok.push(Math.floor(c / 100) + ' dollars and ' + (c % 100) + ' cents');
        // The digits with the point taken out: the string the letters test used
        // to read as the same answer.
        no.push(String(c));
      } else {
        no.push(String(c));
      }
      no.push(moneyAnswer(c + 100), moneyAnswer(c >= 200 ? c - 100 : c + 1000));
      return { ok: ok, no: no };
    };
    /* A shape read off the round's own placeholder, with this question's amount
       written into it. The placeholder is an example, and an example a round
       will not accept is the fault one step before the marking. */
    const asShown = (eg, c) => {
      if (eg.indexOf('$') >= 0) return '$' + moneyAnswer(c);
      if (/c$/.test(eg)) return c < 100 ? c + 'c' : null;
      if (eg.indexOf('.') >= 0) return moneyAnswer(c);
      return c % 100 === 0 ? String(c / 100) : null;   // bare is dollars
    };

    // Every step of the pool that takes an amount, and both ranges of each.
    [['numeralwrite', 0], ['numeralwrite', 1], ['addmoney', 0], ['addmoney', 1],
     ['shopsmall', 1], ['shopsmall', 2], ['shop', 1], ['shop', 2]].forEach(pair => {
      const qs = (GEN_BANKS[pair[0]](30, pair[1]) || []).filter(q => q.money);
      if (!qs.length && pair[0] !== 'numeralwrite') {
        bad.push(pair[0] + ' from ' + pair[1] + ' deals no money question');
      }
      qs.forEach(q => {
        const want = moneyCents(q.answer);
        if (!want) { bad.push(pair[0] + ': the answer "' + q.answer + '" is not an amount'); return; }
        const c = want.cents; seen.push(c);
        const f = forms(c);
        f.ok.forEach(w => {
          if (mark(q, w) !== 'correct') {
            bad.push(pair[0] + ': "' + w + '" is not marked right for ' + money(c));
          }
        });
        f.no.forEach(w => {
          if (mark(q, w) === 'correct') {
            bad.push(pair[0] + ': "' + w + '" is marked right for ' + money(c));
          }
        });
        /* The numeral read and the unit missed. Half marks, because telling a
           20c coin from a $20 note is the feature this round is evidence for. */
        if (c < 100 && mark(q, String(c)) !== 'partial') {
          bad.push(pair[0] + ': "' + c + '" for ' + money(c) + ' is ' +
                   mark(q, String(c)) + ', not half marks');
        }
        (String(q.placeholder || '').replace(/^e\.g\.\s*/, '').split(/\s+or\s+/))
          .filter(Boolean).forEach(eg => {
            if (!moneyCents(eg)) {
              bad.push(pair[0] + ': the box shows "' + eg + '", which is not an amount');
              return;
            }
            const w = asShown(eg, c);
            if (w && mark(q, w) !== 'correct') {
              bad.push(pair[0] + ': the box shows "' + eg + '" and "' + w +
                       '" is marked wrong for ' + money(c));
            }
          });
      });
    });

    /* And the sweep: a round that takes a typed amount and was never flagged is
       marked as letters, which is the whole of this bug. */
    Object.keys(GEN_BANKS).forEach(t => {
      [0, 1, 2].forEach(f => {
        let qs = [];
        try { qs = GEN_BANKS[t](8, f) || []; } catch (e) { return; }
        qs.forEach(q => {
          if (q.money || (q.type !== 'typein' && q.type !== 'shop')) return;
          const text = String(q.question || '') + ' ' + String(q.say || '');
          if (/\$|\bcents?\b|\bdollars?\b/.test(text) || /^\d+\.\d{2}$/.test(q.answer || '')) {
            bad.push(t + ' asks for an amount ("' + q.question + '") and is not marked as money');
          }
        });
      });
    });
    return { bad: [...new Set(bad)], n: seen.length, amounts: [...new Set(seen)].length };
  });
  say('  ' + out.n + ' money questions marked, ' + out.amounts + ' different amounts');
  out.bad.slice(0, 10).forEach(x => bad('money: ' + x));
});

check('ordering', 'no indicator is awarded a level without the one below it', async ctx => {
  const out = await ctx.page.evaluate(() => {
    // Every combination of per-level verdicts, including levels never asked.
    const bad = [];
    const mkE = v => v === null ? null : {
      seen: 4, right: v === 'yes' ? 4 : v === 'part' ? 2 : 0,
      why: { x: { n: 4, ok: v === 'yes' ? 4 : v === 'part' ? 2 : 0, partial: 0 } }
    };
    const vs = [null, 'no', 'part', 'yes'];
    let n = 0;
    vs.forEach(a => vs.forEach(b => vs.forEach(c => {
      n++;
      const ev = newAcsfEvidence(); ev.asked = 0;
      ev.byInd = { '03': { PLA: mkE(a), PLB: mkE(b), L1: mkE(c) } };
      Object.keys(ev.byInd['03']).forEach(k => { if (!ev.byInd['03'][k]) delete ev.byInd['03'][k]; });
      const r = acsfProfile(ev, true).rows.find(x => x.ind === '03');
      const lvl = r.level;
      if (lvl === 'PLB' && a !== 'yes') bad.push('PLA=' + a + ' PLB=' + b + ' L1=' + c + ' awarded PLB');
      if (lvl === 'L1' && (a !== 'yes' || b !== 'yes')) {
        bad.push('PLA=' + a + ' PLB=' + b + ' L1=' + c + ' awarded L1');
      }
    })));
    return { bad: bad, n: n };
  });
  say('  ' + out.n + ' combinations of per-level verdicts checked');
  out.bad.forEach(x => bad('ordering: ' + x));
});

check('blanks', 'pressing Submit over an untouched question is not an attempt', async ctx => {
  const probe = await ctx.page.evaluate(() => {
    // The shapes an untouched answer arrives in, one per question type that
    // submits something other than an empty string.
    return [
      [{ type: 'typein' }, '', false, 'typed nothing'],
      [{ type: 'typein' }, '   ', false, 'only spaces'],
      [{ type: 'typein' }, 'milk', true, 'typed a word'],
      [{ type: 'shop' }, moneyAnswer(0), false, 'shop, no coins picked'],
      [{ type: 'shop' }, moneyAnswer(450), true, 'shop, coins picked'],
      [{ type: 'form' }, ' |  | ', false, 'form, no chips placed'],
      [{ type: 'form' }, 'Ali | Hassan | ', true, 'form, chips placed'],
      [{ type: 'unscramble' }, '', false, 'tiles, none placed'],
      [{ type: 'clockset' }, '', false, 'clock, hands untouched'],
      [{ type: 'mc' }, 'milk', true, 'an option tapped']
    ].map(p => ({ label: p[3], want: p[2], got: !!answerGiven(p[0], p[1]) }));
  });
  probe.forEach(p => {
    if (p.got !== p.want) {
      bad('answerGiven: ' + p.label + ' counts as ' + (p.got ? 'an answer' : 'nothing') +
          ', should be ' + (p.want ? 'an answer' : 'nothing'));
    }
  });
  say('  answerGiven: ' + probe.filter(p => p.got === p.want).length + ' of ' + probe.length + ' shapes right');

  // And the whole run: Submit pressed over every question with nothing entered.
  const out = await play(ctx.page, 'blank', function (ev, prof) {
    // The .01 rows are the ones a run signal is written from ("follows
    // simple instructions", "takes part"), so a blank run shows up there.
    const learning = prof.rows.filter(r => r.ind === '01')
      .reduce((a, r) => a.concat((r.why || []).filter(w => !w.notAsked)
        .map(w => ({ lvl: w.lvl, text: w.text, n: w.n, ok: w.ok }))), []);
    return {
      asked: ev.asked, tries: ev.attempts, blanks: ev.blanks || 0,
      learning: learning,
      awarded: prof.rows.filter(r => r.level && r.level !== 'NYA')
                        .map(r => r.code + '=' + r.level)
    };
  });
  say('  a run of Submit-with-nothing: ' + out.asked + ' asked, ' +
      out.tries + ' attempts, ' + out.blanks + ' blanks');
  if (out.tries > 0) bad('blanks: ' + out.tries + ' blank submissions were counted as attempts');
  if (out.awarded.length) {
    bad('blanks: a learner who entered nothing was still awarded ' + out.awarded.join(', '));
  }
  // Three separate faults made the same screenshot once: the attempts counter,
  // the signal that reads it, and the level ordering that let PLB stand
  // without PLA. Each is checked on its own, because any one of them alone is
  // enough to tell a teacher that a learner who did nothing took part.
  out.learning.forEach(w => {
    if (w.ok > 0) {
      bad('blanks: "' + w.text.slice(0, 50) + '" reports ' + w.ok + ' of ' + w.n +
          ' after a run where nothing was entered');
    }
  });
  say('  .01 signals after that run: ' +
      (out.learning.map(w => w.lvl + ' ' + w.ok + '/' + w.n).join(', ') || 'none'));
});

check('gating', 'a failed indicator is never asked, or credited, above its stage', async ctx => {
  const out = await ctx.page.evaluate(() => {
    // A learner good at everything except reading .03/.04. Nothing at Stage B
    // for those two should ever be put to them, or credited to them.
    soloMode = true;
    TEST = newTestGame('solo', 'test:level');
    const askedAt = {}, creditedAt = {};
    let guard = 0;
    while (!testFinished() && guard++ < 90) {
      testStartRound();
      const qs = (soloQuestions || []).slice();
      if (!qs.length) break;
      TEST.tally = []; TEST.roundPts = 0;
      qs.forEach(function (q, i) {
        soloQIdx = i; currentStudentQ = q;
        const st = (TEST.roundSteps || [])[i] || {};
        const cl = acsfClaimsFor(st);
        const reading = cl.some(c => c[0] === '03' || c[0] === '04');
        cl.filter(c => acsfStageOpen(c[0], c[1]))
          .forEach(c => { askedAt[c[0] + '|' + c[1]] = 1; });
        const a = reading ? 'zzzz' : q.answer;
        const tier = reading ? 'wrong' : answerTier(q, a);
        testRecord(tier, tier === 'correct' ? 10 : 0, false, a);
      });
      testEndRound();
      TEST.round++;
    }
    Object.keys(TEST.ev.byInd).forEach(function (ind) {
      Object.keys(TEST.ev.byInd[ind]).forEach(function (lvl) { creditedAt[ind + '|' + lvl] = 1; });
    });
    return {
      total: TEST.ev.asked,
      askedAbove: Object.keys(askedAt).filter(k => /^0[34]\|(PLB|L1)/.test(k)),
      creditedAbove: Object.keys(creditedAt).filter(k => /^0[34]\|(PLB|L1)/.test(k)),
      othersClimbed: Object.keys(TEST.plan.done)
        .filter(k => !/^0[34]/.test(k) && TEST.plan.done[k] === 'yes' && /PLB/.test(k)).length
    };
  });
  say('  a learner who fails only Reading .03/.04: ' + out.total + ' questions, ' +
      out.othersClimbed + ' other stages still climbed to PLB');
  out.askedAbove.forEach(k => bad('gating: ' + k + ' was asked above a stage the learner failed'));
  out.creditedAbove.forEach(k => bad('gating: ' + k + ' was credited above a stage the learner failed'));
  if (!out.othersClimbed) bad('gating: failing .03/.04 stopped every other indicator climbing too');
});

/* The report that earned this one: a teacher sent a screenshot of .12 reading
   "Working towards PLA.12, some of it came through, not enough of it to say
   more", and asked why the candidate had not got Stage B. The candidate had
   done nothing wrong. .12 carried alwaysPartial, which acsfLevelState applies
   at every level, so no run could ever award it and the two Stage B questions
   the app has were never once asked. .02 and .01 were failing the same way for
   different reasons. A run answered perfectly is the one case where the report
   cannot blame the learner, so it is the case worth pinning down. */
check('reachable', 'a perfect run awards every indicator the top its evidence supports', async ctx => {
  const RUNS = 4;
  const tally = {};
  for (let i = 0; i < RUNS; i++) {
    const out = await play(ctx.page, 'right', (ev, prof) => {
      /* Not meta.ceiling: the top an indicator can honestly reach. Every Level 1
         claim in the app is marked partial on purpose, because one round is not
         the sustained performance Level 1 describes, and acsfLevelState will not
         award a level carried only by partial claims. So .03 .04 and .08 stop at
         Stage B and are right to.
           The app works this out itself now, in acsfAwardCeiling, because the
         panel needs the same answer to decide whether to print "at least": a
         verdict and the bar it is judged against drifting apart is the bug this
         whole file exists to catch. Called here rather than recomputed, so there
         is one definition and the check reads the one the app ships. */
      const top = acsfAwardCeiling;
      return acsfWalked().map(ind => {
        const r = prof.rows.find(x => x.ind === ind);
        /* A level cannot be both awarded and never asked about. The staircase
           only judges a stage once every feature in it has been dealt, so a row
           saying "not asked" underneath an awarded level means the plan counted
           a feature as shown that the learner was never given: My Learning
           deals five different asks and only two stand for a feature, and
           marking the bank's whole list on the first of them told the staircase
           that "locates learning materials" had been put to the learner while
           the panel printed, truthfully, that it had not. */
        const ghost = r.why.filter(w => w.notAsked && r.level &&
                                        acsfLvlNo(w.lvl) <= acsfLvlNo(r.level))
                           .map(w => w.lvl + ' ' + w.text);
        /* The app's own ceiling must never be printed as the learner's
           shortfall. A row that reached the top this app can award says "at
           least", because what stopped the climb was the app running out of
           things to ask, not the learner running out of answers. .03 .04 and
           .08 read "PLB.03 / Working towards Level 1.03" under a performance
           with nothing wrong in it, which is a sentence about a learner. */
        const atTop = r.level && top(ind) && acsfLvlNo(r.level) >= acsfLvlNo(top(ind));
        return { ind: ind, want: top(ind), got: r.level, line: r.line, ghost: ghost,
                 shortfall: !!(atTop && !/^At least /.test(r.line || '')),
                 sub: r.sub || '' };
      });
    });
    out.forEach(r => {
      const t = tally[r.ind] || (tally[r.ind] = { want: r.want, hit: 0, n: 0, lines: {} });
      t.n++;
      if (r.got === r.want) t.hit++;
      t.lines[r.line] = (t.lines[r.line] || 0) + 1;
      r.ghost.forEach(g => bad('reachable: .' + r.ind + ' was awarded ' + r.got +
                               ' with a feature the panel calls not asked: ' + g));
      if (r.shortfall) {
        bad('reachable: .' + r.ind + ' reached the top this app can award but reads "' +
            r.line + '" instead of "At least ...", so the app\'s ceiling is printed ' +
            'as the learner\'s shortfall');
      }
      if (r.shortfall && /Working towards/.test(r.sub)) {
        bad('reachable: .' + r.ind + ' is at the app\'s ceiling but its note still says "' +
            r.sub + '"');
      }
    });
  }
  Object.keys(tally).sort().forEach(ind => {
    const t = tally[ind];
    say('  .' + ind + '  ' + t.hit + '/' + t.n + ' reached ' + (t.want || 'nothing to reach') +
        '   ' + Object.keys(t.lines).join(' | '));
    // Every run, not most of them. .01 used to come out three different ways
    // across four identical perfect runs, which is a verdict about the deal
    // rather than about the learner.
    if (t.want && t.hit < t.n) {
      bad('reachable: .' + ind + ' reached ' + t.want + ' on only ' + t.hit + ' of ' + t.n +
          ' perfect runs (' + Object.keys(t.lines).join(' | ') + ')');
    }
  });
});

check('leaks', 'no question speaks or shows its own answer, and no two options collide', async ctx => {
  const rows = await ctx.page.evaluate(() => {
    soloMode = true;
    const names = [...new Set(Object.keys(GEN_BANKS)
      .concat(BANK_SECTIONS.reduce((a, s) => a.concat(s.banks), [])))];
    const out = [];
    let n = 0;
    names.forEach(function (g) {
      [0, 1, 2].forEach(function (from) {
        let qs = [];
        try {
          qs = isGenBank(g) ? GEN_BANKS[g](14, from) : getQuestions(g, 14);
          // A bank that can be played as tap-the-answer gets its options at
          // round time, so a check that skips this never sees them.
          if (mcAppliesTo(g)) attachMcChoices(qs, g);
        }
        catch (e) { out.push(g + ' [' + from + '] threw ' + e.message); return; }
        (qs || []).forEach(function (q) {
          n++;
          const say = String(q.say || '');
          const ans = String(q.answer == null ? '' : q.answer);
          const nAns = normalize(ans), nSay = normalize(say);
          const asked = String(q.question || '') + ' ' + String(q.label || '');
          // Reading the answer out is the commonest way a question stops
          // measuring anything. Two ways it is not a leak: the speech is only
          // the visible prompt read aloud, so it reveals nothing that is not
          // already on the screen; or the question says the answer is in what
          // you hear, which is the whole task of a listening round. Anything
          // else, a prompt that asks one thing on screen and says another out
          // loud, hands the answer over.
          const onScreen = normalize(String(q.question || '').replace(/<[^>]*>/g, ' '));
          const listening = /you hear|listen/i.test(asked);
          if (nAns && nSay && nSay.indexOf(nAns) >= 0 && nSay !== onScreen && !listening) {
            out.push(g + ': the prompt says "' + say + '" but asks "' +
                     String(q.question || '').replace(/<[^>]*>/g, ' ').trim() +
                     '". The answer ' + ans + ' is only in the audio');
          }
          if (q.choices && q.choices.length) {
            const norm = q.choices.map(c => q.exact ? String(c).trim() : normalize(String(c)));
            const want = q.exact ? ans.trim() : nAns;
            const hits = norm.filter(c => c === want).length;
            // normalize() strips punctuation, so $3.20 and $320 are one option.
            if (hits !== 1) {
              out.push(g + ': ' + hits + ' of [' + q.choices.join(' | ') + '] match answer ' + ans);
            }
            const dup = norm.filter((c, i) => norm.indexOf(c) !== i);
            if (dup.length) out.push(g + ': duplicate options [' + q.choices.join(' | ') + ']');
            /* Every option of an ordering round is the same tiles in a
               different order. Put In Order offered "3 9", "9 3", "I was
               tired on Sunday night." and "She is from Vietnam too.", because
               two tiles have only two orderings and the rest were padded from
               the bank that shares this question's *shape* rather than its
               content. Three options that are not orderings at all point at
               the answer as plainly as any spoken leak. */
            if (q.type === 'unscramble' || q.type === 'gramscramble') {
              const tiles = function (x) {
                return String(x).trim().split(/\s+/).map(w => normalize(w)).sort().join(' ');
              };
              const want = tiles(ans);
              const odd = q.choices.filter(c => tiles(c) !== want);
              if (odd.length) {
                out.push(g + ': ' + odd.length + ' of [' + q.choices.join(' | ') +
                         '] are not orderings of ' + ans);
              }
            }
          }
          if (/🔊|hear|listen/i.test(asked) && !say) {
            out.push(g + ': asks the learner to listen but plays nothing. ' + asked.trim());
          }
        });
        /* The picture identifies the question, not the answer. Safe or Private
           took its icon straight from the answer, 🙂 for safe and 🔒 for private,
           over two options, so the padlock was the answer printed above the
           question. Every rule above reads the speech and the options; none of
           them had ever looked at the icon.

           Where the picture IS the question it identifies the answer too, and
           rightly: a device round shows a keyboard and asks what it is called.
           So the tell is narrower than "the icon predicts the answer". It is a
           round whose written question already carries the item, and whose
           pictures are fewer than its questions and line up one for one with the
           answers it has to give. That is a picture of the answer and nothing
           else. */
        const iconed = (qs || []).filter(q => q.icon);
        if (iconed.length > 3) {
          const icons = new Set(iconed.map(q => String(q.icon)));
          const prompts = new Set(iconed.map(q => String(q.question || '')));
          const answers = new Set(iconed.map(q => normalize(String(q.answer == null ? '' : q.answer))));
          const seen = {};
          let tells = true;
          iconed.forEach(function (q) {
            const k = String(q.icon), a = normalize(String(q.answer == null ? '' : q.answer));
            if (seen[k] === undefined) seen[k] = a; else if (seen[k] !== a) tells = false;
          });
          if (tells && icons.size > 1 && icons.size === answers.size && icons.size < prompts.size) {
            out.push(g + ' [' + from + ']: ' + icons.size + ' pictures over ' + prompts.size +
                     ' questions, one for each of its ' + answers.size +
                     ' answers. The picture is a picture of the answer');
          }
        }
      });
    });
    return { out: [...new Set(out)], n: n };
  });
  say('  ' + rows.n + ' questions read across every bank');
  rows.out.forEach(bad);
});

check('audio', 'Hear it again appears exactly where a round speaks', async ctx => {
  const out = await ctx.page.evaluate(() => {
    soloMode = true;
    const names = [...new Set(Object.keys(GEN_BANKS)
      .concat(BANK_SECTIONS.reduce((a, s) => a.concat(s.banks), [])))];
    const mism = [], per = {};
    let n = 0;
    names.forEach(function (g) {
      [0, 1].forEach(function (from) {
        let qs = [];
        try {
          qs = isGenBank(g) ? GEN_BANKS[g](8, from) : getQuestions(g, 8);
          if (mcAppliesTo(g)) attachMcChoices(qs, g);
        } catch (e) { return; }
        qs.forEach(function (q) {
          n++;
          const speaks = !!speechFor(q);
          currentStudentQ = q;
          showStudentQuestion(q, Date.now());
          const shown = document.getElementById('s-hear-btn').style.display !== 'none';
          per[g] = per[g] || { speaks: 0, shown: 0 };
          if (speaks) per[g].speaks++;
          if (shown) per[g].shown++;
          if (speaks !== shown) {
            mism.push(g + ': ' + (speaks ? 'speaks but shows no button' : 'shows the button but says nothing') +
                      '. ' + String(q.question || q.answer || '').slice(0, 40));
          }
        });
      });
    });
    try { clearInterval(studentTimerInt); } catch (e) {}
    return { mism: [...new Set(mism)], n: n,
             speaking: Object.keys(per).filter(k => per[k].speaks > 0).length };
  });
  say('  ' + out.n + ' questions shown, ' + out.speaking + ' banks speak');
  out.mism.forEach(bad);
});

check('speech', 'a word is still heard after the app has been away', async ctx => {
  // "The pronunciation did not play, even with the volume up, so I could not
  // pick the right option." A phone pauses the speech engine when the page
  // goes into the background and does not reliably start it again; every
  // word after that was accepted and never heard, while the music came back
  // because the audio context is resumed by name. Nothing on the screen said
  // so, on a round whose whole task is to tap the word you just heard.
  //
  // Half of this check is a sweep: cancel() and then speak() was written out
  // fourteen times over, and one copy fixed would have left thirteen live.
  const stray = [];
  ['index.html', 'game.html', 'tracing.html'].forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const n = (src.match(/speechSynthesis\.speak\(/g) || []).length;
    if (n) stray.push('speech: ' + f + ' speaks directly ' + n + ' time' + (n === 1 ? '' : 's') +
                      ' instead of through speakUtterance(), so it cannot wake the engine first');
    // The locale belongs to applyVoice, which walks down to whatever English
    // the phone has. A page naming one for itself is a page that can be mute.
    const locale = (src.match(/\.lang\s*=\s*'en-[A-Z]{2}'/g) || []).length;
    if (locale) stray.push('speech: ' + f + ' sets a locale on an utterance ' + locale +
                           ' time' + (locale === 1 ? '' : 's') + ' instead of leaving it to applyVoice()');
    if (!/src="speech\.js"/.test(src)) stray.push('speech: ' + f + ' does not load speech.js');
  });
  // A page that speaks but is not precached cannot speak offline.
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  if (!/\.\/speech\.js/.test(sw)) bad('speech: speech.js is not in the service worker CORE list');
  stray.forEach(bad);

  // The other half is the phone: pause the engine the way a notification
  // does, come back, and see whether the next word and the replay button are
  // heard.
  const page = await ctx.browser.newPage({ viewport: { width: 420, height: 860 } });
  await page.addInitScript(() => {
    // An engine that behaves like a phone's: paused while the page is away,
    // and dropping anything handed to it while it is.
    let paused = false;
    const log = [];
    window.__speech = { log, get paused() { return paused; }, pause() { paused = true; } };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      get speaking() { return false; }, get pending() { return false; },
      get paused() { return paused; },
      // A phone with a voice, because a phone without one is the voices
      // check's business and an empty list now means "wait for the list".
      getVoices() { return [{ name: 'Samantha', lang: 'en-US' }]; },
      speak(u) { log.push({ text: u.text, heard: !paused }); },
      cancel() {}, pause() { paused = true; }, resume() { paused = false; },
      addEventListener() {}, removeEventListener() {}
    } });
    // A plain utterance, so the fake voice above can be assigned to one.
    window.SpeechSynthesisUtterance = function (t) {
      this.text = t; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null;
      this.addEventListener = function () {};
    };
  });
  await page.goto(ctx.base + '/game.html?mode=solo&game=sightwords', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof ACSF_POOL !== 'undefined', null, { timeout: 15000 });
  const out = await page.evaluate(async () => {
    soloSelectedType = 'sightwords'; soloMode = true; mcMode = true;
    startSoloGame();
    const first = window.__speech.log.length;
    // The phone goes away: a notification, the lock screen, a call.
    window.speechSynthesis.pause();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    window.__speech.log.length = 0;
    soloNextQuestion();          // the next word the round deals
    const next = window.__speech.log.slice();
    window.__speech.log.length = 0;
    studentReplay();             // and the learner pressing Hear it again
    const again = window.__speech.log.slice();
    try { clearInterval(studentTimerInt); } catch (e) {}
    return { first: first, next: next, again: again };
  });
  await page.close();
  if (!out.first) bad('speech: the first question of a words game said nothing at all');
  [['the next question', out.next], ['Hear it again', out.again]].forEach(([what, said]) => {
    if (!said.length) bad('speech: ' + what + ' said nothing after the app came back');
    else if (said.some(s => !s.heard)) {
      bad('speech: ' + what + ' ("' + said[0].text + '") was handed to a paused engine after the ' +
          'app came back, so the learner heard nothing');
    }
  });
  say('  3 pages swept for a stray speak(), and a words round played across a background pause');
});

check('voices', 'no Australian voice never means no sound', async ctx => {
  // "If the phone has en-US or en-GB installed but not en-AU, and the code
  // passes lang = 'en-AU' without falling back, the utterance can silently do
  // nothing." It could, in three places: applyVoice asked for a bare en-AU
  // whenever the voice list had not loaded, tracing.html asked for it always,
  // and an === 'en-AU' test did not recognise the en_AU that Android reports.
  const page = await ctx.browser.newPage({ viewport: { width: 420, height: 860 } });
  await page.addInitScript(() => {
    // An engine whose voice list, and whose willingness to use a voice, the
    // test sets: a listed voice with no data behind it is the iOS case where
    // the Australian Siri voice was never downloaded.
    let voices = [], hollow = [], mute = false;
    const said = [];
    window.__eng = {
      said: said,
      set(v, opts) { voices = v; hollow = (opts || {}).hollow || []; mute = !!(opts || {}).mute; },
      arrive(v) { voices = v; try { window.speechSynthesis.dispatchEvent(new Event('voiceschanged')); } catch (e) {} }
    };
    const listeners = {};
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      get speaking() { return false; }, get pending() { return false; }, get paused() { return false; },
      getVoices() { return voices; },
      speak(u) {
        said.push({ text: u.text, voice: u.voice ? u.voice.name : null, lang: u.lang });
        const dead = mute || (u.voice && hollow.indexOf(u.voice.name) >= 0);
        if (mute && !u.voice) { return; }                       // nothing at all, ever
        setTimeout(() => {
          if (dead) u._fire('error', { error: 'synthesis-failed' });
          else { u._fire('start', {}); u._fire('end', {}); }
        }, 0);
      },
      cancel() {}, resume() {}, pause() {},
      addEventListener(k, f) { (listeners[k] = listeners[k] || []).push(f); },
      removeEventListener() {},
      dispatchEvent(e) { (listeners[e.type] || []).forEach(f => f(e)); }
    } });
    window.SpeechSynthesisUtterance = function (t) {
      this.text = t; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null;
      const ls = {};
      this.addEventListener = (k, f) => { (ls[k] = ls[k] || []).push(f); };
      this._fire = (k, d) => { (ls[k] || []).forEach(f => f(d || {})); };
    };
  });
  await page.goto(ctx.base + '/game.html?mode=solo&game=sightwords', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof speakUtterance === 'function', null, { timeout: 15000 });

  const AU = { name: 'Karen', lang: 'en-AU' }, AU_ = { name: 'Karen', lang: 'en_AU' };
  const GB = { name: 'Daniel', lang: 'en-GB' }, US = { name: 'Samantha', lang: 'en-US' };
  const IN = { name: 'Veena', lang: 'en-IN' }, FA = { name: 'Dariush', lang: 'fa-IR' };

  // Each case: the voice list the phone has, and the voice the learner should
  // end up hearing. The last field is what used to happen instead.
  const cases = [
    { what: 'only American English', list: [US, FA],      want: 'en-US' },
    { what: 'British and American',  list: [US, GB, FA],  want: 'en-GB' },
    { what: 'Australian as en_AU',   list: [US, AU_],     want: 'en_AU' },
    { what: 'Australian present',    list: [US, GB, AU],  want: 'en-AU' },
    { what: 'Indian English only',   list: [IN, FA],      want: 'en-IN' },
    { what: 'no English at all',     list: [FA],          want: 'en'    },
    { what: 'a hollow Australian voice', list: [AU, GB, US], hollow: ['Karen'], want: 'en-GB' }
  ];
  for (const c of cases) {
    const heard = await page.evaluate(async (c) => {
      window.__eng.set(c.list, { hollow: c.hollow || [] });
      window.__eng.said.length = 0;
      workingVoice = null;                       // each case is a fresh device
      const u = new SpeechSynthesisUtterance('cat');
      applyVoice(u);
      await new Promise(r => { u.onend = r; u.onerror = r; speakUtterance(u); setTimeout(r, 3000); });
      const said = window.__eng.said;
      return said.length ? said[said.length - 1].lang : null;
    }, c);
    if (heard !== c.want) {
      bad('voices: with ' + c.what + ' the learner should hear ' + c.want +
          ' but the utterance went out as ' + heard);
    }
  }

  // The list that has not loaded yet. This is the one that reached learners:
  // every call site asks while getVoices() is still empty.
  const late = await page.evaluate(async () => {
    window.__eng.set([], {});
    window.__eng.said.length = 0;
    workingVoice = null;
    const u = new SpeechSynthesisUtterance('cat');
    applyVoice(u);                                    // nothing to pick yet
    speakUtterance(u);
    await new Promise(r => setTimeout(r, 120));
    const spokeEarly = window.__eng.said.slice();
    window.__eng.arrive([{ name: 'Samantha', lang: 'en-US' }]);
    await new Promise(r => setTimeout(r, 200));
    return { early: spokeEarly, all: window.__eng.said.slice() };
  });
  if (late.early.length) {
    bad('voices: spoke as ' + late.early[0].lang + ' before the phone had loaded its voice list');
  }
  if (!late.all.length || late.all[late.all.length - 1].lang !== 'en-US') {
    bad('voices: a list that arrived late was not used; the word went out as ' +
        (late.all.length ? late.all[late.all.length - 1].lang : 'nothing'));
  }

  // A list that never arrives must still ask for English, not for a locale
  // this phone may not have.
  const never = await page.evaluate(async () => {
    window.__eng.set([], {});
    window.__eng.said.length = 0;
    workingVoice = null;
    const u = new SpeechSynthesisUtterance('cat');
    applyVoice(u);
    await new Promise(r => { u.onend = r; u.onerror = r; speakUtterance(u); setTimeout(r, 1200); });
    return window.__eng.said.slice();
  });
  if (!never.length) bad('voices: with no voice list at all, nothing was spoken');
  else if (never[never.length - 1].lang !== 'en') {
    bad('voices: with no voice list at all the word went out as ' +
        never[never.length - 1].lang + ', which a phone without that locale will not say');
  }

  // And the verdict the rest of the app reads: false while anything is heard,
  // true only when every rung has been tried and none of them made a sound.
  const silent = await page.evaluate(async () => {
    window.__eng.set([{ name: 'Samantha', lang: 'en-US' }], {});
    workingVoice = null;
    const ok = new SpeechSynthesisUtterance('cat');
    applyVoice(ok);
    await new Promise(r => { ok.onend = r; ok.onerror = r; speakUtterance(ok); setTimeout(r, 1500); });
    const afterGood = speechIsSilent();
    window.__eng.set([{ name: 'Samantha', lang: 'en-US' }], { hollow: ['Samantha'], mute: true });
    workingVoice = null;
    const bad2 = new SpeechSynthesisUtterance('cat');
    applyVoice(bad2);
    await new Promise(r => { bad2.onend = r; bad2.onerror = r; speakUtterance(bad2); setTimeout(r, 3000); });
    return { afterGood: afterGood, afterBad: speechIsSilent() };
  });
  if (silent.afterGood) bad('voices: a phone that spoke was recorded as having no voice');
  if (!silent.afterBad) bad('voices: a phone where every rung failed was not recorded as silent');

  await page.close();
  say('  ' + cases.length + ' voice sets, a list that arrives late, one that never does');
});

check('repeats', 'no bank repeats inside a run, and the launch count is a real count', async ctx => {
  const rows = await ctx.page.evaluate(() => {
    return Object.keys(GEN_BANKS).map(function (g) {
      resetGenSeen();
      const ten = getQuestions(g, 10), tk = new Set(ten.map(qKey));
      resetGenSeen();
      const twenty = getQuestions(g, 20), wk = new Set(twenty.map(qKey));
      return {
        g: g, got10: ten.length, dup10: ten.length - tk.size,
        got20: twenty.length, dup20: twenty.length - wk.size,
        distinct: genDistinctCount(g), line: countLine(countFor(g, 10))
      };
    });
  });
  const worst = rows.filter(r => r.dup10 || r.dup20);
  say('  ' + rows.length + ' generated banks dealt at 10 and at 20');
  worst.forEach(r => bad('repeats: ' + r.g + ' repeats ' + r.dup10 + ' of 10 and ' +
                         r.dup20 + ' of 20 (' + r.distinct + ' distinct questions exist)'));
  rows.forEach(r => {
    // The launch screen said "12 available" because 12 was written there as a
    // literal. A count that is not measured is a promise the bank cannot keep.
    const claimed = (String(r.line).match(/(\d+)/) || [])[1];
    if (claimed && Number(claimed) > r.distinct) {
      bad('repeats: ' + r.g + ' promises "' + r.line + '" but only ' + r.distinct + ' exist');
    }
  });
});

check('rounds', 'a step deals the round it names, however many you ask for', async ctx => {
  /* "Why did I get five copy a word questions?" was a step's claims disagreeing
     with what its round showed. This is the same disagreement one level down, and
     it hid for as long as it did because every other check deals a pool step eight
     or twenty questions at a time while a run deals it one.

     Devices chose between naming a device and saying what it is for on `i%2`, the
     draw index. Ask for twelve and you see both; ask for one and `i` is 0 and you
     see naming, every single time. The step that carries the two "understands the
     purpose" features dealt the naming round on every run in production, and the
     staircase marked both features shown off the answer.

     So: deal each step the way a run deals it, and the way a game deals it, and
     compare. A round the step deals often when asked for many and never once when
     asked for one is a round chosen by the draw index. The share is what keeps a
     bank of a hundred prices out of it: each sum or amount is a few percent of the
     draw, while a round kind is a third or a half of it. */
  const SHARE = 0.15;      // below this it is content varying, not a round kind
  const DRAWS = 40;
  const out = await ctx.page.evaluate(([share, draws]) => {
    const bad = [];
    /* What a round IS, rather than what this draw of it says: its answer shape,
       the label above it, and the opening of the question. The prices and sums
       that vary inside one round stay inside one key that way. */
    const key = q => (q.type || 'mc') + ' | ' + (q.label || '') + ' | ' +
      String(q.question || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).slice(0, 4).join(' ');
    ACSF_POOL.forEach(function (st) {
      const one = {}, many = {};
      let total = 0;
      for (let i = 0; i < draws; i++) {
        // Dealt fresh each time: the no-repeat memory is what let the odd purpose
        // question through now and then, which is the sort of luck that turns a
        // broken step into a flaky one instead of a failing one.
        resetGenSeen();
        try { testQuestions(st, 1).forEach(q => { one[key(q)] = 1; }); } catch (e) { return; }
      }
      for (let i = 0; i < 4; i++) {
        resetGenSeen();
        try {
          testQuestions(st, 20).forEach(q => { many[key(q)] = (many[key(q)] || 0) + 1; total++; });
        } catch (e) { return; }
      }
      if (!total) return;
      Object.keys(many).forEach(function (k) {
        if (one[k] || many[k] / total < share) return;
        bad.push(acsfStepKey(st) + ' deals "' + k.split(' | ').pop() + '" as ' +
                 Math.round(many[k] / total * 100) + '% of a long draw and never once ' +
                 'in ' + draws + ' single draws');
      });
    });
    return { bad: bad, pool: ACSF_POOL.length };
  }, [SHARE, DRAWS]);
  say('  ' + out.pool + ' pool steps dealt ' + DRAWS + ' times one at a time and four times twenty at a time');
  out.bad.forEach(x => bad('rounds: ' + x));
});

check('oddone', 'the odd one out is clearly odd', async ctx => {
  // "I get coffee, bag, pen and bus. The answer is bus because it's transport,
  // but it could be coffee too because it's food and the others are things."
  //
  // Whether a category is clearly nameable is a judgement no script can make:
  // "household" and "toys" read as categories but behave as catch-alls, and
  // almost anything can be argued into them. So this check does the two
  // computable parts and then makes the judgement part impossible to skip:
  // adding a category fails here until someone has thought about every
  // pairing it creates and recorded the decision below.
  const REVIEWED = ['animals', 'fruit', 'transport', 'clothes', 'body',
                    'food', 'weather', 'colors', 'numbers', 'actions'];
  const out = await ctx.page.evaluate(reviewed => {
    const bad = [];
    const names = Object.keys(ODD_GROUPS);
    names.filter(n => reviewed.indexOf(n) < 0).forEach(n => {
      bad.push('the category "' + n + '" has not been through a pairing review. ' +
               'check it against every other category, then add it to REVIEWED in this check');
    });
    reviewed.filter(n => names.indexOf(n) < 0).forEach(n => {
      bad.push('the category "' + n + '" is reviewed here but no longer exists');
    });
    // Two categories that share a word can put the same word on both sides.
    names.forEach(function (a, i) {
      names.slice(i + 1).forEach(function (b) {
        if (oddClashes(a, b)) return;
        const shared = ODD_GROUPS[a].filter(w => ODD_GROUPS[b].indexOf(w) >= 0);
        if (shared.length) {
          bad.push(a + ' and ' + b + ' both contain ' + shared.join(', ') +
                   ' but are not declared a conflict');
        }
      });
    });
    const qs = genOddOneOut(80);
    const pairs = {};
    qs.forEach(function (q) {
      pairs[q.group + ' + ' + q.oddGroup] = 1;
      if (oddClashes(q.group, q.oddGroup)) {
        bad.push('a round paired ' + q.group + ' with ' + q.oddGroup + ', which are declared to clash');
      }
      if (ODD_GROUPS[q.group].indexOf(q.answer) >= 0) {
        bad.push('the odd word is also in the group: ' + q.answer + ' in ' + q.group);
      }
      const same = q.choices.filter(c => c !== q.answer);
      if (same.some(w => ODD_GROUPS[q.group].indexOf(w) < 0)) {
        bad.push('a word that should belong is not in ' + q.group + ': ' + same.join('/'));
      }
      const es = q.choices.map(c => emo(c));
      if (new Set(es).size !== es.length) {
        bad.push('two options show the same picture: ' + q.choices.join('/'));
      }
    });
    return { n: qs.length, bad: [...new Set(bad)], pairs: Object.keys(pairs).length,
             cats: names.length };
  }, REVIEWED);
  say('  ' + out.cats + ' categories, ' + out.n + ' rounds across ' + out.pairs + ' pairings');
  out.bad.forEach(x => bad('oddone: ' + x));
});

check('signs', 'every sign is the Australian form, wordless, and precached', async ctx => {
  // "Some of the signs in level check and the game are different from
  // Australian signs and may be interpreted in different ways. They can be
  // especially challenging for pre learners who do not work on them."
  //
  // Three of the eleven drawings ran the prohibition band from lower left to
  // upper right. ISO 7010 and AS 1319 run it the other way, and it was wrong
  // in all three, because the line was written out once per file: rule 20 in
  // its usual shape. No Parking drew its P as a <text> element, so the sign
  // changed shape on any device without Arial.
  //
  // The wordless line is the bank's own rule, from the comment above SIGNS:
  // "a sign that says EXIT tests nothing, but a green running figure asks the
  // learner to read the meaning." A drawing carrying its own answer in letters
  // is answered by matching two strings, which is a different task from
  // reading the sign, and a different task again for a learner who has letters
  // than for one who has none. The photo this set was redrawn from had "Bus
  // Stop" written across the bus stop flag, which is why the line is here.
  // The options are the other half of the report, and no script can judge
  // them: whether "Chemist" is a fair reading of a green cross is a fact about
  // Australia, not about the file. Five of them were readings of their own
  // picture, so a learner who read the sign correctly was marked wrong. A green
  // cross is what Australian pharmacies put on the shopfront; a red disc says
  // stop; a figure going over backwards says no running; a running figure says
  // do not run; and a vehicle drawn front on has a windscreen and lights
  // whether it runs on a road or on rails.
  //
  // So this does what `oddone` does with its categories: it makes the judgement
  // impossible to skip. Changing an option, or adding a sign, fails here until
  // somebody has looked at the drawing again and written the new set down.
  const REVIEWED = {
    'no-smoking':  ['No cooking', 'No matches', 'No smoking', 'Smoking area'],
    'no-parking':  ['Bus parking', 'No parking', 'Parking here', 'Pay to park'],
    'no-entry':    ['Come in', 'Do not enter', 'One way', 'Push the door'],
    'wet-floor':   ['Clean the floor', 'Mind the step', 'Swimming pool', 'Wet floor'],
    'danger':      ['Danger', 'Information', 'Question', 'Turn left'],
    'first-aid':   ['Add here', 'First aid', 'Hospital car park', 'Staff only'],
    'exit':        ['Entry only', 'Exit this way', 'Fire alarm', 'Sports room'],
    'toilets':     ['Changing room', 'Family room', 'Toilets', 'Waiting room'],
    'wheelchair':  ['Bicycle parking', 'Hospital', 'No wheelchairs', 'Wheelchair access'],
    'no-food':     ['Free lunch', 'No food or drink', 'Restaurant', 'Wash your hands'],
    'bus-stop':    ['Bus stop', 'Car park', 'No buses', 'Taxi rank'],
  };

  const signs = await ctx.page.evaluate(() =>
    SIGNS.map(s => ({ icon: s.icon, answer: s.answer, alts: s.alts })));
  const dir = path.join(ROOT, 'icons');
  const files = fs.readdirSync(dir).filter(f => /^sign-.+\.svg$/.test(f));
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  let bands = 0;

  signs.forEach(function (s) {
    const name = 'sign-' + s.icon + '.svg';
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) {
      bad('signs: ' + s.answer + ' has no drawing at icons/' + name);
      return;
    }
    // Comments carry the reasoning, including the words this check forbids on
    // the face of a sign, so they come out before anything is read.
    const body = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');

    const offered = [s.answer].concat(s.alts).sort().join(' / ');
    if (!REVIEWED[s.icon]) {
      bad('signs: ' + s.icon + ' has not been through an options review. Look at the ' +
          'drawing and ask of every option whether it is a fair reading of that picture ' +
          'in Australia, then write the set into REVIEWED in this check');
    } else if (REVIEWED[s.icon].join(' / ') !== offered) {
      bad('signs: the options on ' + s.icon + ' have changed since they were reviewed.\n' +
          '      reviewed: ' + REVIEWED[s.icon].join(' / ') + '\n' +
          '      now:      ' + offered + '\n' +
          '      Look at the drawing again: an option that is also a correct reading of ' +
          'that picture marks a learner wrong for reading the sign right');
    }

    if (/<text[\s>]|<tspan[\s>]/.test(body)) {
      bad('signs: ' + name + ' draws with a <text> element. Draw it as a path: ' +
          'on a device without that font the shape of the sign changes');
    }
    const shown = (body.match(/>[^<>]+</g) || []).join(' ').toLowerCase();
    [s.answer].concat(s.alts).forEach(function (w) {
      if (shown.indexOf(w.toLowerCase()) >= 0) {
        bad('signs: ' + name + ' has "' + w + '" written on it, which is one of its own ' +
            'options. A sign carrying its answer in words is answered by matching ' +
            'letter shapes, not by reading the sign');
      }
    });

    (body.match(/<line[^>]*>/g) || []).forEach(function (ln) {
      const num = a => Number((ln.match(new RegExp(a + '="([-\\d.]+)"')) || [])[1]);
      const x1 = num('x1'), y1 = num('y1'), x2 = num('x2'), y2 = num('y2');
      if (![x1, y1, x2, y2].every(Number.isFinite)) return;
      // Short or axis-aligned lines are detail, not the band.
      if (Math.abs(x2 - x1) < 8 || Math.abs(y2 - y1) < 8) return;
      bands++;
      if ((x2 - x1) * (y2 - y1) <= 0) {
        bad('signs: the band on ' + name + ' runs lower left to upper right. ' +
            'ISO 7010 and AS 1319 run it upper left to lower right, which is the way ' +
            'it appears on the street');
      }
    });

    if (sw.indexOf('./icons/' + name) < 0) {
      bad('signs: icons/' + name + ' is not in the sw.js precache list, so a learner ' +
          'who opens the game offline gets a question with no picture');
    }
  });

  Object.keys(REVIEWED).filter(k => !signs.some(s => s.icon === k)).forEach(function (k) {
    bad('signs: ' + k + ' is reviewed in this check but is no longer in SIGNS');
  });

  const used = signs.map(s => 'sign-' + s.icon + '.svg');
  files.filter(f => used.indexOf(f) < 0).forEach(function (f) {
    bad('signs: icons/' + f + ' is not used by any sign in SIGNS');
  });
  say('  ' + signs.length + ' signs, ' + files.length + ' drawings, ' + bands + ' prohibition bands');
});

check('propernouns', 'a name keeps its capital in the answer and in the hint', async ctx => {
  // "Months need a capital first letter. Both hint and correct answer should
  // be fixed."
  //
  // Days had already been fixed for exactly this and months were missed, on
  // the very next line, because the decision was written out once per bank.
  // A round that shows "November" and marks "november" makes writing the
  // capital a near miss and leaving it off full marks, which is backwards.
  // The hint is the same fault one step further on: it reveals the first
  // parts of the answer, and the phoneme tiles it builds them from are all
  // lowercase, so it printed "n" over a word the round was teaching as
  // "November".
  const out = await ctx.page.evaluate(() => {
    buildBank();
    const bad = [];
    let n = 0;
    Object.keys(questionBank).forEach(function (g) {
      (questionBank[g] || []).forEach(function (q) {
        if (!q || q.type !== 'word' || !q.word) return;
        n++;
        const word = String(q.word);
        const ans = String(q.answer === null || q.answer === undefined ? '' : q.answer);
        if (spellLetterForm(word) !== spellLetterForm(ans)) {
          bad.push(g + ': shows "' + word + '" but the answer is "' + ans + '"');
          return;
        }
        // Only words that carry a capital are in question. A common noun is
        // spelled lowercase and lowercase is what it should mark.
        if (word !== word.toLowerCase() && ans !== word) {
          bad.push(g + ': shows "' + word + '" but marks "' + ans +
                   '", so writing the capital is scored as a near miss');
        }
        const revealed = hintParts({ answer: ans }).join('');
        if (revealed !== ans) {
          bad.push(g + ': the hint for "' + ans + '" spells it "' + revealed + '"');
        }
      });
    });
    return { bad: [...new Set(bad)], n: n };
  });
  say('  ' + out.n + ' spelling words checked');
  out.bad.forEach(x => bad('propernouns: ' + x));
});

check('models', 'an example would score full marks under its own round\'s rule', async ctx => {
  // "The sentence needs correct capitalization and punctuation. Two full
  // stops, and two capital letters in each sentence are needed."
  //
  // Tightening a rule is how a round starts showing an Example that its own
  // marking calls partly correct. Four of the six Write Two Sentences models
  // carry one capital in a sentence ("I work in a shop. I start at nine."),
  // so a blanket two-capital rule would have done exactly that. The rule
  // belongs to the model whose ask names a name and a country, and this is
  // what keeps the ask, the example and the marking in step.
  const out = await ctx.page.evaluate(() => {
    const bad = [];
    SENTENCE_MODELS.forEach(function (m, i) {
      const q = GEN_BANKS['modelsentence'](1, i)[0];
      // The example must be well formed by the rule its own round applies:
      // marked against a different example, so the copy test does not fire,
      // it is just a learner's two sentences and should score full marks.
      const other = SENTENCE_MODELS[(i + 1) % SENTENCE_MODELS.length].model;
      const tier = typeinTier(Object.assign({}, q, { answer: other }), m.model);
      if (tier !== 'correct') {
        bad.push('"' + m.model + '" is shown as the Example but its own round marks it ' + tier);
      }
      // "Some may just copy." Handing the example back is not adapting it.
      if (typeinTier(q, m.model) === 'correct') {
        bad.push('"' + m.model + '" scores full marks when copied straight back');
      }
      if (typeinTier(q, m.model.toUpperCase()) === 'correct' ||
          typeinTier(q, m.model.replace(/\s+/g, '  ')) === 'correct') {
        bad.push('"' + m.model + '" scores full marks when copied back with the case or spacing changed');
      }
      if (String(q.icon || '').indexOf('Example') < 0) {
        bad.push('"' + m.model + '" is shown with no Example label over it');
      }
      // A round may only demand the capital a proper noun takes when it has
      // told the learner that is what it wants.
      if ((q.capsEach || 1) > 1 && !/name and country/i.test(q.question)) {
        bad.push('"' + q.question + '" demands ' + q.capsEach +
                 ' capitals a sentence without naming what the second is for');
      }
    });
    ACSF_POOL.filter(s => s.type === 'modelsentence').forEach(function (s) {
      if (s.from === undefined || s.from === null) {
        bad.push('the modelsentence pool step names no model, so the level check ' +
                 'gets whichever one index 0 happens to be');
      }
    });
    return { bad: [...new Set(bad)], n: SENTENCE_MODELS.length };
  });
  say('  ' + out.n + ' examples checked against their own marking');
  out.bad.forEach(x => bad('models: ' + x));
});

check('register', 'the level check stays at the register it is for', async ctx => {
  // Three rules. Two from one report: "questions chosen from elementary
  // phonics may have words that are too difficult for a pre-learner", and
  // "a listening or writing test with a sentence gap to type into may be
  // harder than PLA or PLB requires". The third from another asking whether
  // two digit deduction questions are needed for PLB numeracy.
  //
  // Length is a bad proxy here and the numbers say so: the pool's longest word
  // is "wheelchairs" on a street sign, which a PLA learner is genuinely
  // expected to recognise, while the elementary bank's longest is the shorter
  // "generation" inside "The nation ___ a new station for the next
  // generation". What separates them is not size, it is what the learner has
  // to do. So the rules are about source and task, not word counts.
  const out = await ctx.page.evaluate(() => {
    const bad = [];
    // Every answer a step can deal, drawn wide enough to see the whole list.
    const poolWords = function (st) {
      let qs = [];
      try { qs = testQuestions(st, 60); } catch (e) { return []; }
      return [...new Set(qs.map(q => String(q.answer || '').toLowerCase()))];
    };
    // 1. Nothing in the pool comes from the elementary banks. They are written
    //    to exercise longer words; a pre-level learner is not assessed by
    //    them, they are defeated by them. Level 1 evidence bought at that
    //    price is not worth having.
    const ELEMENTARY = ['elementary', 'wp2:gap', 'wp2:word', 'wp2:build'];
    ACSF_POOL.forEach(function (st) {
      if (ELEMENTARY.indexOf(st.type) >= 0) {
        bad.push(acsfStepKey(st) + ' draws from the elementary bank ' + st.type);
      }
    });
    // 2. A gap in a sentence may be tapped from options, never typed. Reading
    //    a sentence well enough to choose the missing word is a pre-level
    //    task; producing it from nothing is not.
    const gaps = [];
    // Options are attached when a round deals the step, not when the bank
    // makes the question, so a check that reads testQuestions() alone sees
    // every mc step as typed. Deal it the way testStartRound does.
    ACSF_POOL.forEach(function (st) {
      let qs = [];
      try { qs = testQuestions(st, 6); if (st.mc) attachMcChoices(qs, st.type); }
      catch (e) { return; }
      qs.forEach(function (q) {
        const isGap = !!q.blank ||
                      /_{2,}/.test(String(q.question || '') + String(q.display || ''));
        // Dragging given tiles into order is assembling, not producing: the
        // words are all on the screen. Typing is producing from nothing.
        const tiles = ['unscramble', 'gramscramble', 'phbuild'].indexOf(q.type) >= 0;
        const typed = !tiles && !(q.choices && q.choices.length);
        if (isGap && typed) gaps.push(acsfStepKey(st));
      });
    });
    [...new Set(gaps)].forEach(k => bad.push(k + ' asks the learner to type a word into a sentence gap'));
    // 3. Nothing in the pool asks the learner to subtract. "Sometimes two
    //    digit deduction questions are used. Is this needed for PLB?" It is
    //    not: across all twenty key performance features of .09 .10 and .11
    //    at both stages, the only arithmetic named is adding, and even that
    //    is held to totals of 100 with no carrying. Shop's change round was
    //    in the pool, so a learner who could recognise every note and coin
    //    still had to take $16.50 off $50 to show it.
    const sums = [];
    ACSF_POOL.forEach(function (st) {
      let qs = [];
      try { qs = testQuestions(st, 6); } catch (e) { return; }
      qs.forEach(function (q) {
        const text = String(q.question || '') + ' ' + String(q.say || '');
        if (q.mode === 'change' || /\d\s*(-|\u2212|minus|take away|less than)\s*\d/i.test(text)) {
          sums.push(acsfStepKey(st));
        }
      });
    });
    [...new Set(sums)].forEach(k => bad.push(k + ' asks the learner to subtract'));
    /* 4. A step serving a Stage A feature deals only what that feature names.
          Every one of these was a question credited to a stage above the one
          it belonged to: "6 dollars and 50 cents" against "whole dollar
          monetary amounts up to $10", a price of $10.50 against the same
          words, "behind" against a feature whose own example is "up, down",
          "3:45" against "digital time in whole hours", "necklace" against "a
          very limited number of extremely familiar words", and "Do you work?"
          against "recognises frequently used question words, e.g. who, what".
          A stage is not a rough band. It is a list of what may be asked. */
    const over = [];
    ACSF_POOL.forEach(function (st) {
      /* Read against the features doing the claiming, not against every step
         that happens to show a number. Which Comes First deals the sentence
         "I have lunch at 12:30." and its feature is "Follows print from left
         to right and top to bottom": the clock in it is not what the learner
         is being asked about, and flagging it would be the check inventing a
         rule the framework never wrote.
           Both stages, not just Stage A. "Digital time in whole hours" is a
         Stage B feature, and the quarter hours were being credited to it. */
      const claims = acsfClaimsFor(st);
      /* Money at Stage A only. Every Stage A money feature says "whole dollar"
         in its own words, three times over, and that is what was being broken.
         Stage B is where cents belong and its features say so: "Monetary
         amounts up to $100, e.g. 50c, $24.50", "= $25.20". */
      const money = claims.some(c => c[1] === 'PLA' && /whole dollar/.test(c[2].toLowerCase()));
      // Time at any stage, because the feature itself names the limit and it
      // happens to sit at Stage B: "Digital time in whole hours".
      const time = claims.some(c => /whole hours/.test(c[2].toLowerCase()));
      if (!money && !time) return;
      let qs = [];
      try { qs = testQuestions(st, 10); if (st.mc) attachMcChoices(qs, st.type); }
      catch (e) { return; }
      const k = acsfStepKey(st);
      qs.forEach(function (q) {
        const said = String(q.say || '');
        const face = [q.answer].concat(q.choices || []).join(' ');
        // "$6.50" and "50c" are the same fault wearing different clothes, and
        // reading only for a decimal point let Put In Order deal 5c, 10c and
        // 50c against "whole dollar notes and coins up to $10".
        const spoken = /\bcents?\b/i.test(said);
        const shown = /\d+\.(?!00\b)\d\d/.test(face) || /\b\d{1,2}c\b/.test(face);
        if (money && (spoken || shown)) {
          over.push(k + ' deals an amount with cents: ' + (spoken ? said : face).slice(0, 40));
        }
        if (time && /\b\d{1,2}:(?!00\b)\d\d/.test(face)) {
          over.push(k + ' deals a time that is not a whole hour: ' + face.slice(0, 40));
        }
      });
    });
    // The word lists, where the fault is what the bank holds and not the draw.
    ACSF_POOL.forEach(function (st) {
      if (st.type === 'position' && !st.from) {
        poolWords(st).forEach(function (w) {
          if (w !== 'up' && w !== 'down') {
            over.push(acsfStepKey(st) + ' deals the position word "' + w + '"');
          }
        });
      }
      /* The level check dictates five words and no others. Filtering the
         themed banks down to their shorter words was the first attempt and it
         still reached "back" and "tie": fruit, clothing and body parts are not
         the vocabulary the framework has in mind, however hard the list is
         filtered. Copying the words Copy It shows was the second, and it held
         the right register while missing that dictation is the harder task:
         the word is gone off the screen, and the feature this round claims
         asks for "a very limited number of extremely familiar words". */
      if (st.type === 'spelling') {
        poolWords(st).forEach(function (w) {
          if (SPELL_WORDS.indexOf(w) < 0) {
            over.push(acsfStepKey(st) + ' dictates "' + w + '", which is not one of the five');
          }
        });
        if (SPELL_WORDS.length > 6) {
          over.push('the level check dictates ' + SPELL_WORDS.length +
                    ' words, which is no longer "a very limited number"');
        }
      }
      if (st.type === 'questionwords') {
        poolWords(st).forEach(function (w) {
          if (WH_WORDS.indexOf(w) < 0) {
            over.push(acsfStepKey(st) + ' asks for "' + w + '", which is not a question word');
          }
        });
      }
    });
    [...new Set(over)].forEach(x => bad.push(x));
    return { bad: bad, pool: ACSF_POOL.length };
  });
  say('  ' + out.pool + ' pool steps checked for source, task and arithmetic');
  out.bad.forEach(x => bad('register: ' + x));
});

/* "A learner at Pre Level 1 Stage A cannot read Goodbye / Please / Good
   morning." The listening, numeracy and digital rounds were answered by
   reading their options, so a reading failure was recorded against .08 to .13
   and every indicator was confounded with .03 and .04. An option now speaks
   when its chip is tapped, or carries a picture, or is a numeral. */
check('options', 'an option a pre-level learner cannot read can be heard', async ctx => {
  const out = await ctx.page.evaluate(() => {
    const bad = [];
    // Indicators where reading the option is not the thing being measured.
    const NONREADING = ['08', '09', '10', '11', '12', '13'];
    ACSF_POOL.forEach(function (st) {
      let qs = [];
      try { qs = testQuestions(st, 8); if (st.mc) attachMcChoices(qs, st.type); }
      catch (e) { return; }
      const claims = acsfClaimsFor(st);
      const nonReading = claims.length &&
        claims.every(c => NONREADING.indexOf(c[0]) >= 0);
      qs.forEach(function (q) {
        /* 3. And the same for the prompt. A round outside Reading and Writing
              says what to do out loud: "Smallest to biggest" was shown and
              never spoken, so a learner who could order coins perfectly well
              had no way to learn that ordering was the task. The options half
              of this rule is below; they are one rule seen from two sides. */
        if (nonReading && !speechFor(q)) {
          bad.push(acsfStepKey(st) + ' never says what to do: "' +
                   String(q.question || q.label || '').slice(0, 40) + '"');
        }
        const opts = q.choices || [];
        if (!opts.length) return;
        /* 1. Hearing an option may not hand the answer over. Sight Words says
              "that" and asks which written word it is; speaking the options
              would let a learner match sound to sound and never read. */
        if (q.hearOpts) {
          const said = normalize(speechFor(q) || '');
          const ans = normalize(q.answer || '');
          if (ans && said && said.indexOf(ans) >= 0) {
            bad.push(acsfStepKey(st) + ' speaks its options and its own answer: "' +
                     String(q.question || '').slice(0, 40) + '"');
          }
        }
        /* 2. Every option of a round that is not about reading has to be
              reachable without reading it: a drawing the bank supplied, a
              picture from the emoji map, a numeral, or the chip. */
        if (!nonReading) return;
        const pics = opts.map(w => (q.art && q.art[w]) || emo(w));
        const allPics = pics.every(Boolean) && !q.textOnly &&
                        !pics.some((e, i) => pics.indexOf(e) !== i);
        opts.forEach(function (w) {
          /* A numeral, a time, an amount or an ordinal symbol is not something
             the learner has to read: recognising it is the numeracy feature
             itself ("Matches 0 to 10 symbols with oral name", "Recognise oral
             ordinal numbers from 1st to 3rd"). Words are the problem. */
          const numeric = !/[a-z]/i.test(String(w)) ||
                          /^\d+(st|nd|rd|th)$/i.test(String(w).trim()) ||
                          /^\d[\d:.$ ]*(am|pm)?$/i.test(String(w).trim());
          if (q.hearOpts || allPics || numeric) return;
          bad.push(acsfStepKey(st) + ' asks the learner to read "' + w +
                   '" to answer a question about .' + claims[0][0]);
        });
      });
    });
    return { bad: [...new Set(bad)], pool: ACSF_POOL.length };
  });
  say('  ' + out.pool + ' pool steps checked for an option that can only be read');
  out.bad.forEach(x => bad('options: ' + x));
});

check('spread', 'no one game fills the level check', async ctx => {
  // "Why did I get 5 or maybe 6 copy a word questions?" A step that keeps
  // coming back is usually the picker's model of it disagreeing with what the
  // round credits, so the staircase never records it as done.
  const MAX = 4;
  /* A budget, not a law of nature. The level check asks what the staircase
     needs and no more, so this number only moves when the claim map moves.
     It caught three questions a perfect run was spending on steps whose whole
     worth had already been taken by an earlier pick in the same round: the
     ranking for a round is worked out before any of its questions is chosen,
     so it cannot see its own overlap. If this fails after a deliberate change
     to the pool, read the new number, satisfy yourself the extra questions are
     each showing something, and move it. If it fails after a change to the
     picker, it is probably padding. */
  const BUDGET = 60;
  for (const how of ['right', 'sloppy']) {
    const out = await play(ctx.page, how, function (ev, prof, seen, perStep) {
      const labels = {};
      seen.forEach(function (s) {
        if (s.q.label) labels[s.step.type + ' / ' + s.q.label] = (labels[s.step.type + ' / ' + s.q.label] || 0) + 1;
      });
      return { asked: ev.asked, per: perStep, labels: labels };
    });
    const over = Object.keys(out.per).filter(k => out.per[k] > MAX);
    say('  ' + how.padEnd(8) + out.asked + ' questions over ' +
        Object.keys(out.per).length + ' games, most-dealt ' +
        Object.keys(out.per).sort((a, b) => out.per[b] - out.per[a])[0] +
        ' x' + Math.max(...Object.values(out.per)));
    over.forEach(k => bad('spread (' + how + '): ' + k + ' was dealt ' + out.per[k] +
                          ' times, more than ' + MAX));
    if (out.asked > BUDGET) {
      bad('spread (' + how + '): the run asks ' + out.asked + ' questions, over the ' +
          BUDGET + ' it needs. Check whether a step is being dealt that shows nothing ' +
          'the round had not already asked for');
    }
    Object.keys(out.labels).forEach(k => {
      if (out.labels[k] > MAX) bad('spread (' + how + '): ' + k + ' came up ' + out.labels[k] + ' times');
    });
  }
});

/* "One slip on a three-feature stage closes the indicator at NYA." A Stage A
   stage of three features with one wrong answer is 2 of 3, which is under the
   three-quarters bar, so acsfReviewStages closed the indicator and the learner
   was reported NYA and never asked Stage B. A second ask is what the whole of
   Pre Level 1 is described as needing: "may require prompting" is in the Stage
   B features themselves. */
check('retry', 'a wrong answer at Stage A earns one second ask, and only one', async ctx => {
  // A learner who is right about everything except the first ask of Reading
  // .03 and .04 at Stage A, and right when asked again. They must climb.
  const out = await ctx.page.evaluate(missTwice => {
    const play = function (retryGoesRight) {
      soloMode = true; myScore = 0;
      TEST = newTestGame('solo', 'test:level');
      const retried = [], seen = {};
      let guard = 0, thirds = [];
      while (!testFinished() && guard++ < 90) {
        testStartRound();
        const qs = (soloQuestions || []).slice();
        if (!qs.length) break;
        TEST.tally = []; TEST.roundPts = 0;
        qs.forEach(function (q, i) {
          soloQIdx = i; currentStudentQ = q;
          const st = (TEST.roundSteps || [])[i] || {};
          const again = q.retryOf || null;
          if (again) {
            retried.push(again.slice());
            // A feature may not come back a third time.
            again.forEach(function (k) {
              if (seen[k]) thirds.push(k);
              seen[k] = 1;
            });
          }
          // Does this question stand for a Stage A reading feature?
          const reading = ((q.acsf || acsfClaimsFor(st)) || [])
            .some(c => (c[0] === '03' || c[0] === '04') && c[1] === 'PLA');
          const miss = reading && (!again || !retryGoesRight);
          let a;
          if (miss) a = 'zzzz';
          else {
            a = q.answer;
            if (isOpenQ(q)) a = (q.choices || []).find(c => (q.declines || []).indexOf(c) < 0) || q.answer;
            if (q.freeText) a = 'My name is Ali. I am from Iraq.';
          }
          const tier = miss ? 'wrong' : answerTier(q, a);
          testRecord(tier, tier === 'correct' ? 10 : 0, false, a);
        });
        testEndRound();
        TEST.round++;
      }
      return {
        asked: TEST.ev.asked,
        retries: retried.length,
        thirds: [...new Set(thirds)],
        left: (TEST.plan.retry || []).length,
        // Queued against actually asked. A second ask that is queued and then
        // quietly thrown away is the same to the learner as never having one,
        // and it does not show up as a leftover: dropping it empties the queue
        // too. Drawing a single candidate and abandoning the retry when it
        // collided with the question they just missed lost about one run in
        // five this way.
        queued: Object.keys(TEST.plan.retried).length,
        asked2: [...new Set([].concat.apply([], retried))].length,
        done: Object.assign({}, TEST.plan.done),
        prompted: Object.keys(TEST.ev.byInd).reduce(function (n, ind) {
          const lv = TEST.ev.byInd[ind].PLA || { why: {} };
          return n + Object.keys(lv.why).filter(k => lv.why[k].prompted).length;
        }, 0)
      };
    };
    /* The same learner, but every second ask is offered the very question
       they just missed as its first candidate. A bank does collide on its own
       (a dozen signs, and the draw is a shuffle), and when it did, a retry
       that took one candidate and gave up on a collision lost the second ask
       without trace. Forced here so it is not left to chance. */
    const real = window.testQuestions;
    const last = {};
    window.testQuestions = function (step, n) {
      const got = real(step, n) || [];
      const k = acsfStepKey(step);
      const dup = last[k];
      if (dup && n > 1) got.unshift(Object.assign({}, dup));
      else if (dup && n === 1) return [Object.assign({}, dup)];
      if (got.length) last[k] = got[got.length - 1];
      return got;
    };
    let collided;
    try { collided = play(true); } finally { window.testQuestions = real; }
    return { rescued: play(true), stuck: play(false), collided: collided };
  }, false);

  const r = out.rescued, k = out.stuck;
  say('  slipped once then right: ' + r.asked + ' questions, ' + r.retries +
      ' second asks, .03 Stage A ' + (r.done['03|PLA'] || 'open'));
  say('  wrong both times:        ' + k.asked + ' questions, ' + k.retries +
      ' second asks, .03 Stage A ' + (k.done['03|PLA'] || 'open'));

  if (!r.retries) bad('retry: a wrong answer at Stage A earned no second ask');
  const c = out.collided;
  say('  every second ask offered the missed question first: ' + c.asked2 +
      ' of ' + c.queued + ' features still got one');
  [r, k, c].forEach(x => {
    if (x.asked2 < x.queued) {
      bad('retry: ' + (x.queued - x.asked2) + ' of ' + x.queued +
          ' features earned a second ask and never got one');
    }
  });
  ['03', '04'].forEach(ind => {
    if (r.done[ind + '|PLA'] !== 'yes') {
      bad('retry: .' + ind + ' Stage A came back "' + (r.done[ind + '|PLA'] || 'open') +
          '" for a learner who slipped once and was right when asked again');
    }
    if (k.done[ind + '|PLA'] === 'yes') {
      bad('retry: .' + ind + ' Stage A was awarded to a learner who was wrong both times');
    }
  });
  if (!r.prompted) bad('retry: nothing on the panel records that a feature took a second ask');
  ['03', '04'].forEach(ind => {
    if (c.done[ind + '|PLA'] !== 'yes') {
      bad('retry: .' + ind + ' Stage A came back "' + (c.done[ind + '|PLA'] || 'open') +
          '" when the second ask was offered the missed question first');
    }
  });
  r.thirds.forEach(x => bad('retry: ' + x + ' was asked a third time'));
  k.thirds.forEach(x => bad('retry: ' + x + ' was asked a third time'));
  if (r.left) bad('retry: ' + r.left + ' second asks were still queued when the run ended');
});

check('variants', 'every ordinary Test Yourself ladder still finishes', async ctx => {
  const results = await ctx.page.evaluate(() => {
    const variants = ['test:*'].concat(BANK_SECTIONS.filter(s => s.id !== '*').map(s => 'test:' + s.id));
    const out = [];
    variants.forEach(function (v) {
      try {
        soloMode = true; myScore = 0;
        TEST = newTestGame('solo', v, false);
        let rounds = 0, asked = 0, short = 0;
        while (rounds < testRounds()) {
          TEST.round = rounds + 1;
          testStartRound();
          const qs = (soloQuestions || []).slice();
          if (qs.length < TEST_PER_ROUND) short++;
          TEST.tally = []; TEST.roundPts = 0;
          qs.forEach(function (q, i) {
            soloQIdx = i; currentStudentQ = q; asked++;
            const tier = answerTier(q, q.answer);
            testRecord(tier, 10, false, q.answer);
          });
          testEndRound();
          rounds++;
        }
        out.push({ v: v, ok: true, rounds: rounds, asked: asked, short: short });
      } catch (e) {
        out.push({ v: v, ok: false, err: e.message });
      }
    });
    return out;
  });
  say('  ' + results.length + ' variants, ' + results.filter(r => r.ok && !r.short).length + ' clean');
  results.forEach(r => {
    if (!r.ok) bad('variants: ' + r.v + ' threw ' + r.err);
    else if (r.short) bad('variants: ' + r.v + ' dealt ' + r.short + ' short rounds');
    else if (!r.asked) bad('variants: ' + r.v + ' asked nothing');
  });
});

/* Nothing in here ever reached the classroom, and it rotted quietly: every
   decision made about the level check since it was split out of Test Yourself
   went into the solo path alone. A teacher could pick Level Check in the lobby
   and press Start, and the guard on the phone's side, written when a ladder was
   the only kind of test there was, turned the whole room away. The ones
   that did start would have sat a shorter clock and finished at a card with no
   way to the report. So this is the sweep for one sentence: the mode decides
   who pressed Start, and nothing else about the test. */
check('classroom', 'a level check sat in class is the test sat alone, and ends with its report', async ctx => {
  const out = await ctx.page.evaluate(() => {
    const bad = [];
    const $ = id => document.getElementById(id);

    /* Every test the teacher's picker can start is one a phone really starts.
       Put to startStudentTest itself rather than to a copy of its guard here:
       a check that re-states the rule it is checking passes whatever the app
       does with it. The room is a stub, so the phone runs the part that is its
       own: the guard, the clock, and the first round dealt. */
    const realRoom = roomRef, realPlayer = playerId, realSolo = soloMode;
    const asPlayer = (saved, room) => {
      playerId = 'p1'; soloMode = false;
      roomRef = { child: () => ({ once: (e, cb) => cb({ val: () => saved }), update: () => {} }) };
      TEST = null; soloQuestions = []; myScore = 0;
      try { startStudentTest(room); } catch (e) { bad.push('startStudentTest threw: ' + e.message); }
      clearInterval(studentTimerInt);
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
      return TEST;
    };
    [...document.querySelectorAll('#screen-teacher-lobby .q-type-tab')]
      .map(t => t.dataset.type).filter(t => t && isTestType(t))
      .forEach(t => {
        const game = asPlayer({}, { testType: t, testSecs: defaultSecsFor(t) });
        if (!game) bad.push('the teacher can start ' + t + ', and no phone in the room deals it');
        else if (!soloQuestions.length) bad.push(t + ' started in class and dealt no first question');
      });

    /* A phone that reloaded part-way through a level check has nothing in the
       room to pick up: the staircase and the evidence were in memory. It sits
       the check again, from round one and from nought points, rather than
       carrying on from a round number it can only be cut off against. */
    const resumed = asPlayer({ round: 7, level: 0, score: 90, tstate: 'playing' },
                             { testType: 'test:level', testSecs: ACSF_SECS });
    if (resumed) {
      if (resumed.round !== 1) bad.push('a reloaded level check resumed at round ' + resumed.round);
      if (myScore !== 0) bad.push('a level check sat again carried ' + myScore + ' points into the new run');
      if (resumed.secs !== ACSF_SECS) bad.push('a class level check deals on ' + resumed.secs + 's, not ' + ACSF_SECS);
    }
    roomRef = realRoom; playerId = realPlayer; soloMode = realSolo; TEST = null;

    // The same clock, whatever either picker's hidden seconds box was left at.
    selectedQType = 'test:level'; soloSelectedType = 'test:level';
    $('t-limit').value = '10'; $('solo-t-limit').value = '10';
    if (hostSeconds() !== ACSF_SECS) {
      bad.push('a level check runs on ' + hostSeconds() + 's in class, not ' + ACSF_SECS);
    }
    if (soloSeconds() !== hostSeconds()) {
      bad.push('a level check runs on ' + soloSeconds() + 's alone and ' + hostSeconds() + 's in class');
    }

    // The teacher's two screens name the test, and promise it no length.
    updateQCountDisplay();
    const lobby = $('q-count-display').textContent;
    if (/\d+ rounds/.test(lobby)) bad.push('the lobby promises a level check a fixed number of rounds: ' + lobby);
    renderTestHostHead('test:level');
    if ($('test-host-name').textContent !== gameInfoFor('test:level').name) {
      bad.push('the host screen calls a level check "' + $('test-host-name').textContent + '"');
    }
    if (/\d+ rounds/.test($('test-host-len').textContent)) {
      bad.push('the host screen promises a level check rounds: ' + $('test-host-len').textContent);
    }
    // and the ordinary test keeps the wording it had.
    renderTestHostHead('test:*');
    if (!/10 rounds each/.test($('test-host-len').textContent)) {
      bad.push('Test Yourself lost its round count from the host screen');
    }

    // The track measures a level check in skills settled, not against a round
    // count it will run straight past.
    TEST = newTestGame('host', 'test:level');
    const el = document.createElement('div');
    renderTestTrack(el, [{ id: 'a', name: 'Ana', round: 17, level: 0, score: 30,
                           tstate: 'playing', color: '#fff', settled: 4, skills: 12, asked: 51 }]);
    const rowText = el.textContent, rod = el.querySelector('.tgt-rod').style.width;
    if (rowText.indexOf('/' + TEST_ROUNDS) >= 0) {
      bad.push('the host track counts a level check against ' + TEST_ROUNDS + ' rounds: ' + rowText);
    }
    if (Math.round(parseFloat(rod)) !== 33) {
      bad.push('the rod for 4 of 12 skills settled is ' + rod);
    }

    // Both endings offer the report, and only after a level check.
    const btnsOn = () => [...document.querySelectorAll('#screen-test-round .test-acsf-btn')]
      .filter(b => b.getClientRects().length > 0).length;
    const seen = {};
    ['solo', 'class'].forEach(m => {
      myScore = 0;
      TEST = newTestGame(m, 'test:level');
      TEST.ev.asked = 5;
      showTestCard(0, true);
      seen[m] = btnsOn();
      if (seen[m] !== 1) {
        bad.push('the ' + m + ' ending offers ' + seen[m] + ' ways to the report, not one');
      }
      TEST = newTestGame(m, 'test:*');
      showTestCard(0, true);
      if (btnsOn()) bad.push('an ordinary ' + m + ' test offers the teacher panel');
    });

    return { bad: bad, lobby: lobby, rowText: rowText };
  });
  say('  track row: ' + out.rowText);
  out.bad.forEach(bad);

  /* And the run itself. Same pool, same staircase, same length, same evidence:
     the class run is only a solo run somebody else started. */
  const report = (ev, prof) => ({
    asked: ev.asked,
    withEvidence: Object.keys(ev.byInd).length,
    walked: acsfWalked().length,
    finished: !acsfOpenStages().length
  });
  const solo = await play(ctx.page, 'right', report, 'solo');
  const klass = await play(ctx.page, 'right', report, 'class');
  say('  perfect run: ' + solo.asked + ' questions alone, ' + klass.asked + ' in class');
  if (!klass.finished) bad('classroom: a level check sat in class did not settle every skill');
  if (klass.withEvidence < klass.walked) {
    bad('classroom: a class run ended with evidence for only ' + klass.withEvidence +
        ' of ' + klass.walked + ' indicators');
  }
  if (klass.asked !== solo.asked) {
    bad('classroom: the same perfect run is ' + solo.asked + ' questions alone and ' +
        klass.asked + ' in class');
  }
});

check('coverage', 'the coverage totals match the rows they count', async () => {
  // The totals table is read as the app's honest account of what it claims, so
  // it going stale is the same class of fault as a claim the app cannot meet.
  // It had drifted by three: two features moved to "not assessed" when the
  // My Learning game question came out, and one moved to "from the run" when
  // the Stage A goal stopped being asked. Counted rather than trusted now.
  const md = fs.readFileSync(path.join(ROOT, 'docs', 'acsf-coverage.md'), 'utf8');
  const rows = md.match(/^\|\s*\d+\s*\|[^|]*\|\s*([^|]+?)\s*\|[^|]*\|\s*$/gm) || [];
  const counted = {};
  rows.forEach(r => {
    const mark = r.split('|')[3].trim();
    counted[mark] = (counted[mark] || 0) + 1;
  });
  const stated = {};
  (md.match(/^\|\s*(✅ had it|📊 from the run|🔧 extended|🆕 built|❌ not assessed)\s*\|\s*(\d+)\s*\|\s*$/gm) || [])
    .forEach(r => { const p = r.split('|'); stated[p[1].trim()] = Number(p[2].trim()); });
  const total = Object.values(counted).reduce((a, b) => a + b, 0);
  say('  ' + total + ' feature rows across ' + Object.keys(counted).length + ' marks');
  Object.keys(counted).forEach(k => {
    if (stated[k] === undefined) bad('coverage: no total stated for "' + k + '"');
    else if (stated[k] !== counted[k]) {
      bad('coverage: "' + k + '" is stated as ' + stated[k] + ' but ' + counted[k] + ' rows carry it');
    }
  });
  const statedTotal = Number((md.match(/^\|\s*\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*\s*\|\s*$/m) || [])[1]);
  if (statedTotal !== total) {
    bad('coverage: the total is stated as ' + statedTotal + ' but ' + total + ' rows were counted');
  }
});

check('links', 'the generated short pages are in step with build-links.py', async () => {
  // The stubs, sitemap.xml and sw.js are checked in because Pages publishes
  // the repo as it stands and nothing re-runs the generator at deploy time.
  // So they drift silently. Regenerate into a snapshot, compare, and put back
  // whatever moved. This reads the files rather than asking git, so it works
  // on a tree with other work in progress.
  const targets = fs.readdirSync(ROOT)
    .filter(f => f.endsWith('.html'))
    .concat(['sitemap.xml', 'sw.js'])
    .filter(f => fs.existsSync(path.join(ROOT, f)))
    .map(f => path.join(ROOT, f));
  const before = new Map(targets.map(f => [f, fs.readFileSync(f)]));
  try {
    execFileSync('python3', [path.join(ROOT, 'tools', 'build-links.py')], { cwd: ROOT });
  } catch (e) {
    bad('links: build-links.py failed. ' + (e.stderr ? e.stderr.toString().trim() : e.message));
    return;
  }
  const moved = [];
  for (const [f, was] of before) {
    if (!fs.readFileSync(f).equals(was)) { moved.push(path.basename(f)); fs.writeFileSync(f, was); }
  }
  // A file the generator creates that was never checked in counts too.
  fs.readdirSync(ROOT).filter(f => (f.endsWith('.html') || f === 'sitemap.xml' || f === 'sw.js'))
    .map(f => path.join(ROOT, f))
    .filter(f => !before.has(f))
    .forEach(f => { moved.push(path.basename(f) + ' (not checked in)'); fs.unlinkSync(f); });
  if (moved.length) {
    moved.forEach(m => bad('links: ' + m + ' is out of step with build-links.py'));
    say('  the tree has been put back; run python3 tools/build-links.py and commit the result');
  } else {
    say('  ' + targets.length + ' pages match what build-links.py produces');
  }
});

/* ------------------------------------------------------------------- probe */

/* Not a check. Prints real questions from a bank as text, which is the fastest
   way to confirm or refute a report before touching anything. */
async function probe(ctx, bank, n) {
  if (!bank) {
    const names = await ctx.page.evaluate(() => [...new Set(Object.keys(GEN_BANKS)
      .concat(BANK_SECTIONS.reduce((a, s) => a.concat(s.banks), [])))].sort());
    say('Name a bank:\n  ' + names.join('  '));
    return;
  }
  const out = await ctx.page.evaluate(([g, n]) => {
    soloMode = true;
    const qs = [];
    [0, 1, 2].forEach(function (from) {
      let got = [];
      try {
        got = isGenBank(g) ? GEN_BANKS[g](n, from) : getQuestions(g, n);
        // Show the round as a learner meets it: a bank that can be tapped gets
        // its options when the round deals it, not when the bank builds it.
        if (mcAppliesTo(g)) attachMcChoices(got, g);
      } catch (e) {
        qs.push({ err: 'from ' + from + ' threw ' + e.message }); return;
      }
      (got || []).forEach(q => qs.push({
        from: from,
        label: q.label || '',
        question: String(q.question || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
        say: q.say || '',
        choices: (q.choices || []).join(' | '),
        answer: String(q.answer == null ? '' : q.answer),
        type: q.type || 'mc',
        speaks: !!speechFor(q),
        secs: answerSeconds(q, ACSF_SECS)
      }));
    });
    return qs;
  }, [bank, n || 8]);
  out.forEach(q => {
    if (q.err) { say('  ' + q.err); return; }
    say('  [' + q.from + '] ' + (q.label ? q.label + ': ' : '') + (q.question || '(no prompt)'));
    if (q.say) say('        says: "' + q.say + '"');
    if (q.choices) say('        options: ' + q.choices);
    say('        answer: ' + q.answer + '   type ' + q.type +
        '   ' + q.secs + 's' + (q.speaks ? '   speaks' : ''));
  });
}

/* -------------------------------------------------------------------- main */

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === 'list' || args[0] === '--help' || args[0] === '-h') {
    say('checks:');
    Object.keys(CHECKS).forEach(k => say('  ' + k.padEnd(10) + CHECKS[k].blurb));
    say('  probe <bank> [n]  print real questions from a bank');
    return 0;
  }
  const { chromium } = loadPlaywright();
  const server = await serve();
  let browser;
  try {
    browser = await chromium.launch();
  } catch (e) {
    console.error('Cannot launch Chromium: ' + e.message +
                  '\nInstall it with:  npx playwright install chromium');
    await server.close();
    return 2;
  }
  const page = await openApp(browser, server.base, 'signs');
  const ctx = { browser, page, base: server.base };
  let code = 0;
  try {
    if (args[0] === 'probe') {
      await probe(ctx, args[1], Number(args[2]) || 8);
    } else {
      const wanted = args.length ? args : Object.keys(CHECKS);
      const unknown = wanted.filter(w => !CHECKS[w]);
      if (unknown.length) {
        console.error('Unknown check: ' + unknown.join(', ') +
                      '\nTry: node tools/checks/check.js list');
        code = 2;
      } else {
        for (const name of wanted) {
          PROBLEMS = [];
          say('\n== ' + name + ': ' + CHECKS[name].blurb);
          try {
            await CHECKS[name].fn(ctx);
          } catch (e) {
            bad(name + ' threw: ' + (e && e.stack ? e.stack.split('\n')[0] : e));
          }
          if (PROBLEMS.length) {
            code = 1;
            PROBLEMS.forEach(p => say('  FAIL  ' + p));
            say('  ' + PROBLEMS.length + ' problem' + (PROBLEMS.length === 1 ? '' : 's'));
          } else {
            say('  ok');
          }
        }
        // Anything the app logged while the checks ran belongs to whoever
        // changed it last, so it fails too.
        if (ctx.page.errs.length) {
          code = 1;
          say('\n== the page itself logged errors while the checks ran');
          [...new Set(ctx.page.errs)].forEach(e => say('  FAIL  ' + e));
        }
        say('\n' + (code ? 'FAILED' : 'all checks passed'));
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return code;
}

main().then(c => process.exit(c)).catch(e => { console.error(e); process.exit(2); });
