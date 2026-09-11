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
const PLAY = function (how, reportSrc) {
  soloMode = true; myScore = 0;
  TEST = newTestGame('solo', 'test:level');
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
        // Right letters, no capitals, no spaces: the copy a learner at Stage A
        // makes. Only touches typed rounds; tapped ones keep the exact option.
        if (how === 'sloppy' && q.type === 'typein' && !q.anyAnswer) {
          a = String(a).toLowerCase().replace(/ /g, '');
        }
      }
      const tier = how === 'blank' ? 'wrong'
        : isOpenQ(q) ? 'correct'
        : (typeinTier(q, a) || (normalize(a) === normalize(q.answer) ? 'correct' : 'wrong'));
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
function play(page, how, report) {
  return page.evaluate(([playSrc, how, reportSrc]) => {
    return (new Function('return (' + playSrc + ')'))()(how, reportSrc);
  }, [PLAY.toString(), how, report.toString()]);
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
        const tier = isOpenQ(q) ? 'correct' : (reading ? 'wrong' : (typeinTier(q, a) || 'correct'));
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
         Stage B and are right to. The bar is the highest level, within the
         ceiling, carrying at least one piece of evidence the app does not itself
         call partial, from the claim map or from the run signals, since .02
         Stage B has no question of its own and lives entirely in the signals.
         Worked out from the claim map rather than from the run being checked: a
         bar read off the same profile it is judging would move down to meet a
         bug and call it passing. */
      const solid = {};
      ACSF_POOL.forEach(st => acsfClaimsFor(st).forEach(c => {
        if (!c[3]) solid[c[0] + '|' + c[1]] = 1;
      }));
      // Every stage forced open, so this sees the signals the app can produce
      // rather than the ones this particular run reached.
      const open = { at: {}, done: {} };
      ACSF_ORDER.forEach(i => ACSF_STEPS.forEach(l => { open.done[i + '|' + l] = 'yes'; }));
      const able = acsfSignalRows({
        asked: 40, attempts: 40, timeouts: 0, blanks: 0, hints: 1, replays: 1,
        modes: { tap: 20, type: 10, tiles: 5, coins: 3, chips: 2 },
        finished: true, stages: open
      });
      Object.keys(able).forEach(i => Object.keys(able[i]).forEach(l => {
        const w = able[i][l].why || {};
        if (Object.keys(w).some(k => !w[k].partial)) solid[i + '|' + l] = 1;
      }));
      const top = ind => {
        let best = null;
        ACSF_STEPS.forEach(lvl => {
          if (acsfLvlNo(lvl) > acsfLvlNo(ACSF_INDICATORS[ind].ceiling)) return;
          if (solid[ind + '|' + lvl]) best = lvl;
        });
        return best;
      };
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
        return { ind: ind, want: top(ind), got: r.level, line: r.line, ghost: ghost };
      });
    });
    out.forEach(r => {
      const t = tally[r.ind] || (tally[r.ind] = { want: r.want, hit: 0, n: 0, lines: {} });
      t.n++;
      if (r.got === r.want) t.hit++;
      t.lines[r.line] = (t.lines[r.line] || 0) + 1;
      r.ghost.forEach(g => bad('reachable: .' + r.ind + ' was awarded ' + r.got +
                               ' with a feature the panel calls not asked: ' + g));
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
          }
          if (/🔊|hear|listen/i.test(asked) && !say && !q.mute) {
            out.push(g + ': asks the learner to listen but plays nothing. ' + asked.trim());
          }
        });
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
    return { bad: bad, pool: ACSF_POOL.length };
  });
  say('  ' + out.pool + ' pool steps checked for source, task and arithmetic');
  out.bad.forEach(x => bad('register: ' + x));
});

check('spread', 'no one game fills the level check', async ctx => {
  // "Why did I get 5 or maybe 6 copy a word questions?" A step that keeps
  // coming back is usually the picker's model of it disagreeing with what the
  // round credits, so the staircase never records it as done.
  const MAX = 4;
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
    Object.keys(out.labels).forEach(k => {
      if (out.labels[k] > MAX) bad('spread (' + how + '): ' + k + ' came up ' + out.labels[k] + ' times');
    });
  }
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
            const tier = isOpenQ(q) ? 'correct'
              : (typeinTier(q, q.answer) || (normalize(q.answer) === normalize(q.answer) ? 'correct' : 'wrong'));
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
