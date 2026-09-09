# Checks

WordLink is one 11,000-line HTML file with no build step, no test runner and no
CI beyond deploy-on-main. These checks are what stands between a change and the
learners.

They exist because of bug reports. Almost every report turned out to be one
visible case of a rule that was wrong in more places than the reporter happened
to hit, so each check below is the sweep for one class of fault, and the last
column names the report that earned it.

## Running them

Nothing to install if Playwright is already on the machine. There is no
`package.json` here, and adding a dependency would be the first one. The suite
resolves Playwright from wherever it lives, serves the repo from Node's own
http module on a free port, and launches Chromium with no path of its own.

```sh
node tools/checks/check.js              # everything, about three minutes
node tools/checks/check.js audio        # one check
node tools/checks/check.js audio leaks  # a few
node tools/checks/check.js list         # what there is
node tools/checks/check.js probe oddone 20
```

Exit code 0 means every check passed. If Playwright is installed somewhere node
cannot see, the error says so and how to fix it:

```sh
npm install -g playwright
# or
NODE_PATH=/opt/node22/lib/node_modules node tools/checks/check.js
```

## What each one proves

| check | what it proves | the report that earned it |
|---|---|---|
| `boot` | game.html, index.html and all-games.html load with no page or console errors | nothing else catches a syntax error in one 675 KB file before it reaches production |
| `integrity` | every pool step and ladder rung deals, claims a feature and names a skill; every walked indicator has an askable first stage | Test Yourself for the digital section threw; Shop under $10 had no skill; Grammar Unscramble claimed nothing |
| `run` | the level check finishes through the real UI answered right, wrong, sloppily and not at all, each reaching every indicator and producing a report | the core regression |
| `ordering` | over all 64 combinations of per-level verdicts, no indicator is awarded a level without the one below it | "You cannot not get PLA. But get PLB." |
| `blanks` | Submit over an untouched question is not an attempt (typed, tiles, clock, shop and form), and a run of them credits nothing | "I submitted many answers without writing anything but got PLB in learning" |
| `gating` | a learner who fails one indicator is never asked, and never credited, above its stage, while other indicators still climb | the per-indicator staircase |
| `leaks` | no prompt says the answer out loud unless the answer is meant to be heard; no two options collide under `normalize()` | "which one is behind?" spoken aloud; `$3.20` marked right for `$320` |
| `audio` | "Hear it again" appears exactly where a round speaks, and nowhere else | Sight Words had no replay button, and neither did eleven other banks |
| `repeats` | no generated bank repeats a question inside a run of 10 or 20, and the launch screen's count is a measured count | "Screen messages repeats questions in a ten question game. Does it really have 12?" |
| `oddone` | the odd word is not in the group, the other three are, no two options share a picture, and no category joins the game without a pairing review | "I get coffee, bag, pen and bus. The answer is bus, but it could be coffee too" |
| `register` | the level-check pool never draws on the elementary banks, and a gap in a sentence may be tapped but never typed | "The cook ___ a good look at the food on the stove" |
| `spread` | no single game is dealt more than four times in one run | "Why did I get 5 or maybe 6 copy a word questions?" |
| `variants` | all twelve ordinary Test Yourself ladders still finish with full rounds | regression guard for the path that is not the level check |
| `links` | re-running `build-links.py` changes nothing, then puts the tree back | the generated stubs, sitemap and sw.js are checked in and drift silently |

## probe

Not a check. It prints real questions from a bank as text, which is the fastest
way to confirm or refute a report before touching anything:

```
$ node tools/checks/check.js probe sightwords 3
  [0] 🔊 Tap the word you hear
        says: "that"
        options: then | and | that | they
        answer: that   type mc   40s   speaks
```

`node tools/checks/check.js probe` with no bank lists the names.

## Adding one

A check earns its place by failing on a bug that really happened. Before
committing a new one, reintroduce the fault it is meant to catch and watch it
go red. A check that has never failed is a check that proves nothing. Every
check here was tested that way.

Keep the failure message specific enough to act on. `FAIL blanks: 19 blank
submissions were counted as attempts` says what to go and look at; `assertion
failed` does not.
