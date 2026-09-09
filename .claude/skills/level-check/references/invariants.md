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
*no check, judgement*

`ACSF_MIN_EVIDENCE` is 3. Below it the row says what was seen rather than what
the learner can do. One question is an anecdote.

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
> "Get a job does not answer 'what do you want to learn?'"

Wrong questions, not wrong answers. No script finds these; read the round out
loud as the learner meets it.

### 16. Two sentences means two sentences
*check: covered by `run` reaching a verdict, then judgement*

> "Writing 2 sentences adapted from a model cannot be just 1. The test should
> have a model like: My name is David. I'm from Vietnam. And then ask learners
> to write using the model about themselves."

`typeinTier` counts sentences with at least two words, and requires a full stop
and a capital for each before it will say correct. Fewer than asked is partial.
Where the feature says two, one is not evidence of it.

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
