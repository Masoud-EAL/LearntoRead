# The rules, and the reports that produced them

Each rule below was learned from something a learner or a teacher actually saw.
When a new report arrives it is usually either a violation of one of these or a
new rule to add. The report is kept with the rule because the report is what
makes the rule arguable: a rule with no story behind it gets softened by the
next person who finds it inconvenient.

The **check** column names the sweep that enforces it, from
`tools/checks/check.js`. Rules with no check are ones no script can settle;
they are judgement, and they are here so the judgement is not made twice.

---

## Assessment correctness

### 1. A claim quotes a performance feature verbatim
*check: `integrity`*

Every row in `ACSF_CLAIMS` carries the feature's exact wording from the
mapping documents. Not a paraphrase, not a shortened version, not one invented
to fit a game that was already built. `docs/acsf-coverage.md` holds all 132
verbatim.

> "Only include them if they can be assessed based on the documents I sent you."

The corollary is the harder half: a feature the app cannot measure is left
unclaimed and marked not assessed. Level 1 Writing came out entirely for this
reason. Coverage is not the goal; a true report is.

### 2. No level is awarded without the one below it
*check: `ordering`*

> "When 0 of 2 of an indicator is present, it means the learner cannot get that
> indicator. You cannot not get PLA. But get PLB. From these results, the
> learner is just working toward PLA.01."

`acsfRow` climbs with a `climbing` flag that stops at the first level not
shown. A level that was never asked also stops the climb, when features exist
there and the ceiling allows them: nothing to climb on means nothing above can
be claimed either. All 64 combinations of per-level verdicts are checked, not a
sample.

### 3. A run signal is one observation per feature, not one per question
*check: `blanks`*

The whole-run signals for .01 and .02 ("follows simple instructions", "takes
part") are derived from the `why` map, weighted once per feature. Counting them
once per question let a single behaviour speak twenty times and drown the rest
of the profile.

### 4. Pressing Submit over an untouched question is not an attempt
*check: `blanks`*

> "I took the test and submitted many answers without writing or typing
> anything, but I got PLB in learning. Submitting without entering any answer
> should not be considered as following instructions."

`answerGiven(q,ans)` is the one place that decides, and it knows the shapes an
empty answer arrives in: an empty string, whitespace, `moneyAnswer(0)` for a
shop round, a form of separators with no chips. Three outcomes now, not two:
timed out, blank, attempted.

### 5. A step's claims match what its round actually shows
*check: `spread`, `integrity`*

> "Why did I get 5 or maybe 6 copy a word questions? I think it was repeated 3
> times at different parts of the test. Two must be enough."

Not a cap. The picker's model of a step disagreed with what the round credited,
so the staircase never recorded the step as done and kept asking. `byFrom` in
`ACSF_CLAIMS` splits a bank's claims by round kind, which is what made the two
agree. When a game keeps coming back, this is the first place to look.

It came back a second time, in My Learning, the moment `acsfNoteAsked` started
taking the dealt question's word instead of the bank's. One step claimed all
four `.01` features, but a draw of one only ever returned the goal ask, because
the options are shuffled and no two draws share a `qKey`, so nothing the run
dealt could mark "locates learning materials" as shown. It was dealt eleven
times in one run waiting for a question it was never going to be given. Same
fix: `from` chooses the ask, `byFrom` splits the claims, and the three asks that
stand for no feature are not in the pool at all, because a step that claims
nothing cannot serve a stage. `spread` is what caught it.

`acsfNoteAsked` takes `q` as well as the step for this reason. Where a question
carries its own `q.acsf` it has the last word, exactly as it does in
`acsfCredit`, or the plan records features the learner was never shown and the
panel prints "not asked" about a feature the staircase has already counted.

Third time was What Should You Do?, and it is the one to read if you think this
rule is about My Learning. The bank deals two halves from one shuffle, notices
and device problems, and each question names its own feature. But the claim map
listed both features on `base`, so one pool step promised both while the draw
could only ever show the half it dealt. `spread` caught it at six deals of one
game. The tell is a bank whose questions carry different `q.acsf` values while
its claim entry has no `byFrom`: `base` describes what the bank could show, and
the staircase needs what this step will show. It stayed latent for as long as it
did because the run had slack; removing a step elsewhere is what pushed it over
the threshold, so a `spread` failure after an unrelated deletion is usually this
waiting underneath rather than something the deletion broke.

### 6. Nothing is claimed that the app cannot measure
*no check, judgement*

A question that cannot be failed is not evidence. My Learning has no wrong
answer, so it moves no level; it is asked because the answer is worth having,
and it is marked as declining to score. Grammar Unscramble stayed a game but
left the pool when its only claim was withdrawn: a step that claims nothing can
never serve a stage.

### 7. An indicator is asked every feature of its stage, and climbs only when it shows it
*check: `gating`*

> "PLB in an indicator is only given when PLA is achieved. If a learner cannot
> achieve PLA.03 reading, PLB.03 questions are not given to him. Include all
> PLB questions for a learner who has achieved PLA.03. I don't care if the test
> gets longer. For somebody who cannot answer at all, the test may be shorter."

Gating the picker was not enough on its own: a step picked for one indicator
still credited every level it claimed. `acsfStageOpen` is checked in
`acsfCredit` and `acsfNoteAsked` as well as in `acsfPickNext`.

`ACSF_MERCY_QS` is why a stage is not closed by one wrong answer. The first
version of the staircase did exactly that and produced an eleven-question run.

### 8. Evidence needs a floor before it becomes a verdict
*check: `reachable`*

`ACSF_MIN_EVIDENCE` is 3. Below it the row says what was seen rather than what
the learner can do. One question is an anecdote.

The floor is about thin evidence, not about short levels. A level whose every
feature has been put to the learner and answered is judged on what it has, down
to two: `.02` Stage B has three features and the third is only visible when the
learner asks for help, so holding it to three capped every learner good enough
not to need a hint, every run. `acsfEnough` is the one place that decides, and
the stage review and the panel both read it, so what the run decides to ask and
what it finally prints cannot disagree. Two, shown whole. Never one.

### 8a. Every indicator can be awarded
*check: `reachable`*

> "What happened here? Why didn't the candidate get PLB? What are the mistakes?"

The candidate had done nothing wrong. `.12` carried `alwaysPartial`, which
`acsfLevelState` applies at every level, and `acsfRow` climbs only on a full
yes, so no run could award `.12` to anybody: a learner who answered all 62
questions correctly read "Working towards PLA.12, some of it came through, not
enough of it to say more". Worse, `acsfReviewStages` judges through the same
call, so the stage never climbed and the two Stage B questions the app does have
were never once asked in any run.

Three indicators were failing this way at once, for three different reasons, and
`.12` is only the one that got screenshotted. So the rule is not about
`alwaysPartial`: a run answered perfectly is the one case where the report
cannot honestly blame the learner, and every indicator has to reach the top its
evidence supports on every such run. Not most runs: `.01` came out three
different ways across four identical perfect runs, which is a verdict about the
deal rather than about the learner.

The bar is not `meta.ceiling`. Every Level 1 claim in the app is marked partial
on purpose, so `.03` `.04` and `.08` stop at Stage B and are right to. It is the
highest level carrying one piece of evidence the app does not itself call
partial, worked out from the claim map rather than from the run being judged: a
bar read off the profile it is checking moves down to meet a bug.

### 8b. A run signal is credited through the staircase, like everything else
*check: `reachable`, `gating`*

The screenshot that produced rule 8a also had a Stage B row reading "61 of 61
questions the learner answered" sitting underneath a "Working towards PLA"
verdict. `acsfSignalRows` was a fourth way to write evidence and the only one
the staircase did not police: rule 7 put `acsfStageOpen` in `acsfPickNext`,
`acsfCredit` and `acsfNoteAsked`, and signals were missed.

`acsfSignalOpen` is the gate, and it reads the staircase off the evidence rather
than off `TEST.plan`, because a panel rebuilt from storage after a reload has no
plan left to ask and has to print the same page. One wrinkle it has to allow
for: a stage with no claim of its own is stepped over by `acsfNextStage` and
never recorded as reached, so it counts as open once every stage below it has
been shown. `.02` Stage B is the only one, and without that clause the gate
silenced it entirely.

### 8c. The app's ceiling is never printed as the learner's shortfall
*no check, judgement*

"Some of it came through, not enough of it to say more" is a sentence about a
learner. When what actually happened is that the app cannot show more, that
sentence is false in the direction that costs someone. `acsfRow` already has the
honest wording and uses it ("PLB is the highest this run can show for .13"),
so the fault is never the words, it is a row reaching the "working towards"
branch when it should have reached the capped one.

Read every row of a perfect run out loud as a teacher before shipping a change
to the panel. No sentence may describe an app limit as something the learner did
not manage.

---

## Question quality

### 9. A question never gives away its answer
*check: `leaks`*

The commonest way a question stops measuring anything. Two forms:

- **Spoken.** Devices and Ordinals said `'Which one is the ' + name + '?'` out
  loud while the screen asked something else. A prompt may say the answer only
  when the answer is meant to be heard: the speech is the visible prompt read
  aloud, or the question says "the word you hear". Anything else hands it over.
- **In the options.** `normalize()` strips `$` and `.`, so `$3.20` and `$320`
  were the same option and both marked correct. The rent message uses `$230`
  now. The check counts how many options match the answer after normalising; it
  must be exactly one.

### 10. Audio and its replay button agree
*check: `audio`*

> "Sight words need a hear again button. Right? Other games may need this
> option too if they don't."

They did, twelve of them. The cause was one decision written out three times
in three places, so a bank added later matched none of them. `speechFor(Q)` is
now the only answer to "does this round speak, and what", and the button is
shown iff it returns something.

### 11. No question repeats inside a run, and a count on screen is a real count
*check: `repeats`*

> "Screen messages repeats questions in a ten question game. Does it really
> have 12 questions? Why does it repeat then?"

It did not have 12. `poolFor` was calling `GEN_BANKS[type](12,0)` and reporting
the literal 12 back. Counts come from `genDistinctCount` now, measured.

### 12. Content sits at the audience's register
*check: `register`*

> "All questions chosen from elementary phonics may have words that are too
> difficult for a pre-learner. I don't think we need to include those in our
> level check."

Length is a bad proxy and the numbers say so: the pool's longest word is
"wheelchairs" on a street sign, which a PLA learner is genuinely expected to
recognise, while the elementary bank's longest is the shorter "generation" in
"The nation ___ a new station for the next generation". What separates them is
the task, not the size. So: nothing in the pool comes from the elementary
banks, and a gap in a sentence may be tapped from options but never typed:
choosing a missing word is a pre-level task, producing it from nothing is not.

The first attempt at this fix removed `wp2:*` but left the elementary
*sentence* bank, which is where "The cook ___ a good look at the food on the
stove" came from. It had to be reported twice. Sweep the whole class.

### 12a. The level check asks only the arithmetic the band names
*check: `register`*

> "In level check, sometimes two digit deduction questions are used. Is this
> needed for PLB in numeracy?"

No. Across all twenty key performance features of .09 .10 and .11 at both
stages, the only arithmetic named is adding, and even that is held to "a total
of 100 or less (with no carrying)". Nothing at either stage asks a learner to
subtract. Shop's change round was in the pool, so PLB.09 "Australian coins and
notes" and "Monetary amounts up to $100" could only be shown by taking $16.50
off a $50 note first, and a learner who knows every coin and note could be
stopped by the arithmetic and never climb.

The cause was the same shape as rule 5: the step's `from` set where an
alternation started rather than naming the round it dealt, so the pool step and
the ladder rung labelled "Pay the right amount" both dealt change rounds. `from`
now names the round, and only the paying round carries the claims, so the
change round cannot serve a stage at all. It is still a game, and still worth
practising, which is the same answer rule 12 gave the elementary sentences.

### 12b. A round's kind is something the picker asks for, not where it lands in the draw
*check: `spread`, and the counts under it*

> "Last time I played the game and aimed at answering all questions correctly,
> I got the 'how much is it' question many times."

Read the List alternates two rounds, locating a price and comparing two, and it
chose between them on `i%2`, the question's index inside the draw. The level
check deals a step one question at a time, so `i` was always 0 and every one of
the three Read the List rounds in a run was "How much is X?". The comparing
round could not be reached at all, and a three question ladder rung was always
two locates around one compare, in that order.

`from` names the round now. The wrinkle worth knowing is that this bank needed
two axes, kind and range, and `from` was already spent on the range through
`ACSF_RANGED`. Both went onto `from` and into `byFrom`, where the two are
visible together, rather than half in one mechanism and half implied by the
other. The comparing round answers with an item name, not an amount, so it
carries the Reading claim and not the .10 "locate" ones: it shows the table was
read, not that a price was located.

Grep for `i%` in the generators when a report says a question keeps coming back.
Any bank that picks its kind that way deals only kind 0 to the level check.

### 13. The odd one out is clearly odd
*check: `oddone`*

> "It's not always clear which is the odd one. E.g. I get coffee, bag, pen and
> bus. The answer is bus because it's a mode of transportation, but it could be
> coffee too because it's food and others are things. The odd one should
> clearly be odd."

Two fixes. Categories that behave as catch-alls came out (`household`, `toys`,
`nature`), because almost anything can be argued into them. And `ODD_CONFLICTS` records
pairs that must never meet, because the odd one would share the thing that
makes the other three a group: an apple among cake, pie and bun is still food;
orange, lemon and cherry are colours as well as fruit.

Whether a category is clearly nameable is not computable, so the check makes
the judgement impossible to skip: a new category fails until someone has
thought about every pairing it creates and recorded that in the check.

### 14. A picture is the thing it names
*no check, judgement*

> "Charger photo looks like an old plug." · "Tablet and phone look too much
> similar." · "Mouse icon does not look like a mouse."

The emoji map runs out. Where it does, the option carries its own drawing via
`q.art`. When a picture is reported wrong, grep the word. It was wrong in two
banks last time.

`renderMcChoices` also refuses pictures when two options would show the same
one, and phonics rounds opt out entirely: a picture beside "cat" hands over the
answer without any decoding.

### 15. A question asks what it means to ask
*no check, judgement*

> "Camera is not a button. The question can be as simple as 'what is this?'" ·
> "Get a job does not answer 'what do you want to learn?'" · "The answers are
> like: no goals yet, write better. The question doesn't match the answers."

Wrong questions, not wrong answers. No script finds these; read the round out
loud as the learner meets it.

The third one killed the question rather than reworded it. My Learning asked
"Which game would help you most?" and was handed the `GOALS` list, so it asked
about a game and offered "Write better" and "No goal yet". It claimed two
features on that: locating learning materials, and selecting them for a specific
task. It could not show either. It named no task, listed no materials, and
`anyAnswer` accepted every option, so by rule 6 it was not evidence of anything.
Both features are marked not assessed now.

So when a question does not match its options, check what it claims before
rewording it. A mismatch this size usually means the claim was written first and
the question was made to gesture at it, and then the honest fix is to drop the
claim, not to patch the wording until it reads well enough to keep.

### 15a. A round marks the spelling it taught
*check: `propernouns`*

> "Months need a capital first letter. Both hint and correct answer should be
> fixed."

Days had been fixed for this already, and months were missed on the next line
down, because the decision was written out once per bank. A round showing
"November" and marking "november" makes the capital a near miss and leaving it
off full marks, which is backwards.

The hint is the same fault one step further on, and it is why the report says
both. `hintParts` reveals the answer's first parts, and it builds them from the
phoneme tiles, which are lowercase because the phoneme map is written that way.
So it printed "n" over a word the round was teaching as "November". Fixing the
answer alone leaves this live for every word the phoneme map knows, which is
where May, June and July were still lowercase after the answer was right. Two
decisions, two places, one report.

`SPELL_DAYS` and `SPELL_MONTHS` are the only banks here holding proper nouns.
Anything added beside them is a common noun and lowercase is its spelling.

### 16. Two sentences means two sentences
*check: `models`, and `run` reaching a verdict, then judgement*

> "Writing 2 sentences adapted from a model cannot be just 1. The test should
> have a model like: My name is David. I'm from Vietnam. And then ask learners
> to write using the model about themselves."

`typeinTier` counts sentences with at least two words, and requires a full stop
and a capital for each before it will say correct. Fewer than asked is partial.
Where the feature says two, one is not evidence of it.

### 16a. An example is labelled, and scores full marks under its own rule
*check: `models`*

> "Write 'Example' above the model sentences about David." · "Two full stops,
> and two capital letters in each sentence are needed. One for I, one for name
> or country."

The label first: the model is somebody else's answer, shown so the learner can
see the shape. Unlabelled, a learner who cannot yet read the instruction copies
David's sentences back. The Copy It rounds are deliberately not labelled, because
there the model *is* the answer.

The marking is the part worth reading twice. One capital a sentence was all that
was checked, so "My name is david. I am from vietnam." scored full marks with
both proper nouns in lowercase. But the rule as reported, two capitals in every
sentence, would have failed four of the app's own six models: "I work in a shop.
I start at nine." has one capital in each. The app would have been showing an
Example its own marking calls partly correct.

So the rule belongs to the ask, not to the round. `capsEach` is 2 only where the
ask names what the second capital is for ("your name and country"), and the level
check's pool step names that model rather than getting it by landing on index 0.
Elsewhere it stays 1, because "I have two children." is a correct sentence and
marking it down for carrying no proper noun marks the learner on what they were
asked to write about.

The general rule, and what `models` enforces: **tightening a marking rule is how
a round starts showing an example it would itself mark down.** Whenever a rule
moves, check the models against it.

### 16b. The example is not an acceptable answer
*check: `models`*

> "Make sure 'My name is David. I am from Vietnam.' is not accepted. Some may
> just copy."

The feature is "writes two simple sentences **adapted from** a model", and a
model handed straight back has not been adapted. Copying is a round the app
already has, and this is not it. Partly correct rather than wrong, because two
well formed sentences did get written. The comparison is on `spellLetterForm`,
the app's own test for "the same words", so recapitalising or respacing the
example is still a copy.

This one has a tail worth knowing about. The check harness answers a perfect run
with `q.answer`, which for this round *is* the model, so the moment a copy stopped
scoring the perfect run stopped being perfect and `reachable` would have gone red.
`PLAY` types an adapted answer for `q.freeText` now. Any round whose right answer
is something the learner has to produce rather than reproduce will hit the same
thing: the harness's idea of answering correctly is echoing `q.answer`, and that
is exactly the answer such a round must refuse.

It also inverted the rule above it. `models` used to assert that each model scores
`correct`, which is now the opposite of what the round does. It marks the model
against a *different* model, so the copy test does not fire and only the form
rules are being read.

### 17. Every answer gets time in proportion to what it takes to give
*no check, judgement*

> "For level check, time should be set reasonable. Having 30 sec as default for
> all questions doesn't seem reasonable. It can be longer for most, as learners
> are pre-learners."

`answerPace` in one place, from `ACSF_SECS` of 40: tapping a word 1×, tapping a
sentence or dragging a clock hand 1.5×, typing or tiles or coins or chips 2×,
free writing 3×. This replaced two hand-written exceptions that had already
been made for the same reason, one at a time.

### 18. A game that cannot stand alone is not listed as one
*no check, judgement*

> "Which comes first is also a very thin game." · "My learning also doesn't
> make sense as a stand alone game, as all answers are correct."

Both stayed in the level check, where three questions of evidence is exactly
what is wanted, and came off the games list. Two near-identical thin games were
merged rather than both kept.

---

## Working rules

### 19. Every check must have failed on a real bug
*check: this file*

A check that has never gone red proves nothing. Before committing a new one,
reintroduce the fault it is meant to catch and watch it fail. Every check in
`tools/checks/` was tested that way.

### 20. Fix the rule, not the instance
*no check. This is the whole point*

For every report, ask what would have to be true for it to happen, and how many
other places share that. Then fix the shared thing. If the same decision is
written out in more than one place, that is the bug, whatever the symptom was.

### 21. When main has moved, merge
*no check*

More than one session may be pushing to this repo. Both times it happened the
merge was clean and both sides survived. A force push would have lost one.
