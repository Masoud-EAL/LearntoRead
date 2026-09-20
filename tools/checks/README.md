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
| `evidence` | the teacher panel writes down every question the run asked and the answer the learner gave, names only features the profile really counted, stays shut until it is asked for, and prints black on white | "The final report should have an option to show evidence from the test: the questions that were used and the learner's answers to those questions" |
| `printable` | the teacher panel prints as a document: one plain block column the whole way down, nothing positioned, clipped or held at the phone's height, no flex box tall enough to meet a page edge, black on white, an indicator and a question each whole on one page, and both halves of the report on the sheet whether or not the questions were opened on screen | a print preview from an iPhone with four indicators drawn on top of each other and the right-hand side of the sheet cut off |
| `ordering` | over all 64 combinations of per-level verdicts, no indicator is awarded a level without the one below it | "You cannot not get PLA. But get PLB." |
| `blanks` | Submit over an untouched question is not an attempt (typed, tiles, clock, shop and form), and a run of them credits nothing | "I submitted many answers without writing anything but got PLB in learning" |
| `gating` | a learner who fails one indicator is never asked, and never credited, above its stage, while other indicators still climb | the per-indicator staircase |
| `reachable` | over four perfect runs, every indicator reaches the top its evidence supports, every time, and no awarded level carries a feature the panel calls not asked | "Why didn't the candidate get PLB?": .12 could not be awarded to anybody |
| `leaks` | no prompt says the answer out loud unless the answer is meant to be heard; no two options collide under `normalize()`; every option of an ordering round is the same tiles in a different order; and a round whose written question already carries the item does not draw its picture from the answer | "which one is behind?" spoken aloud; `$3.20` marked right for `$320`; "smallest to biggest" offering two orderings and two sentences; 🙂 for safe and 🔒 for private over two options |
| `audio` | "Hear it again" appears exactly where a round speaks, and nowhere else | Sight Words had no replay button, and neither did eleven other banks |
| `speech` | every page speaks through one function that wakes the engine first, and a word is still heard after the app has been in the background | "In the words part the pronunciation did not play, even though the phone volume was up, so I could not pick the right option" |
| `repeats` | no generated bank repeats a question inside a run of 10 or 20, and the launch screen's count is a measured count | "Screen messages repeats questions in a ten question game. Does it really have 12?" |
| `rounds` | every pool step deals the same rounds whether it is asked for one question or for twenty, so a step cannot claim a feature the round it really deals never shows | "how much is it?" every time in Read the List, and then Devices crediting "understands the purpose of some digital devices" off a question that asked what one is called |
| `prices` | every shop round names something its price would buy, in both ranges and in paying and change rounds alike, and no price the bank can deal is left without an item that fits it | "Pay 3 dollars for shoes. Shoes should be changed with tea. Shoes being $3 doesn't make any sense" |
| `money` | every way of writing one amount is marked as that amount, in both the level check's money rounds and the shop, the shape each round's own placeholder shows is a shape it accepts, a bare number reads as dollars, and a round that takes a typed amount cannot be left to the letters test | "I just saw one question in level check, that had a 2 dollar coin, and only accepted 2.00 as the answer, not $2 or 2" |
| `oddone` | the odd word is not in the group, the other three are, no two options share a picture, and no category joins the game without a pairing review | "I get coffee, bag, pen and bus. The answer is bus, but it could be coffee too" |
| `signs` | every sign drawing is the form Australia uses: the prohibition band runs upper left to lower right, nothing is drawn with a font, no sign carries its own answer or any of its options in words, every drawing is used by a sign and precached for offline, and no sign's options have changed since somebody last read them against its picture | "Some of the signs in level check and the game are different from Australian signs and may be interpreted in different ways. They can be especially challenging for pre learners" |
| `coverage` | the totals in docs/acsf-coverage.md match the rows they count, so the app's account of what it claims cannot go stale | found drifted by three after features moved between marks |
| `models` | every Example a round shows would score full marks under that round's own marking, is labelled as an example, and a round demanding the capital a proper noun takes has asked for one | "Write Example above the model sentences"; "two capital letters in each sentence are needed" |
| `propernouns` | a spelling word shown with a capital is marked with that capital, and the hint reveals it with the capital too | "Months need a capital first letter. Both hint and correct answer should be fixed." |
| `register` | the level-check pool never draws on the elementary banks, a gap in a sentence may be tapped but never typed, no question asks the learner to subtract, and a step serving a Stage A feature deals only what that feature names | "The cook ___ a good look at the food on the stove"; "are two digit deduction questions needed for PLB?"; "spelling words like humid and necklace, PLB position words and cents dealt at PLA, quarter hours against whole hours, auxiliary verbs in Question Words" |
| `options` | a round outside Reading says what to do out loud, an option a learner cannot read can be heard or is a picture or a numeral, and an option that speaks never speaks the answer | "A PLA learner cannot read Goodbye / Please / Good morning, so reading failures are recorded against .08 to .13" |
| `retry` | a wrong answer at Stage A earns one second ask and only one, the better attempt stands, and the panel records that it took two | "Ask each PLA feature twice. Do it only when the learner cannot answer correctly the first time." |
| `spread` | no single game is dealt more than four times in one run, and a perfect run stays inside its question budget | "Why did I get 5 or maybe 6 copy a word questions?"; "too many questions or repeated questions of the same type in perfect runs" |
| `variants` | all twelve ordinary Test Yourself ladders still finish with full rounds | regression guard for the path that is not the level check |
| `classroom` | a level check a teacher starts in a class room is the one a learner sits alone: every phone deals it, on the same clock, the same questions, the same length, ending at a card that still reaches the report, while the teacher's screens name it and promise it no rounds | "I have only worked on the solo mode recently, so I want to make sure the teacher mode is also working": a teacher could pick Level Check in the lobby and press Start, and every phone in the room stayed on the waiting screen |
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
