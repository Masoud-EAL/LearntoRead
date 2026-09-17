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

### 5a. A question is asked once where its answer cannot change
*check: `spread`, and the counts under it*

> "In the goals question, only ask the question once, since doing the level check
> means the learner wants to start going to class, which is a goal. For PLB, ask
> the question." · "Change No goal yet to No goal. The word yet makes the option
> somehow defensible, but we want that to be the wrong option for PLB."

The goal ask claimed both the Stage A feature ("Begins to express extremely
simple learning goal") and the Stage B one ("Identifies at least one personal
learning goal"), so the staircase dealt it twice: once to show Stage A, again for
Stage B. The same question, and an answer that cannot have changed in between.

Stage A is a run signal now. Sitting the level check *is* expressing a simple
learning goal: somebody working through it wants to start coming to class. It
sits beside "Demonstrates preparedness for learning, e.g. need to attend class",
counted on attempts like its neighbours, so a run that answered nothing still
shows nothing (rule 4 holds). Stage B stays a question, because naming a goal is
what that feature asks for.

The wording matters to the same end. "No goal yet" is a reasonable thing to say,
and it was meant to be the answer that does **not** identify a goal. "No goal" is
what it says now. The mechanism was already right: `NO_ANSWER_OPTS` makes it a
decline, which scores (nobody is wrong about their own goal) but records the
feature as asked and not shown.

Generalising: **where a question's answer cannot change between two asks, one ask
is all the evidence there is.** Claiming two stages off it buys a second turn and
no second observation.

### 5b. A round does not ask twice for the same thing
*check: `spread`, the run-length budget in it*

> "I do see too many questions or repeated questions of the same type in perfect
> runs, such as two times writing a full name. Check and reduce question numbers
> if possible."

The ranking for a round is worked out once, before any of its questions is
chosen, so it cannot know that two steps near the top of it want the same
feature. Three questions of a perfect run were steps whose whole worth had
already been taken by an earlier pick in the same round. Each pick records what
it covers now and the ones after it are measured against what is left. 63 to 60.

**The trap, and it is worth knowing before you touch this function.** Re-ranking
after every pick is the tidier-looking fix and it is the wrong one. It reshuffles
when each stage opens, and the arrangement it produced dealt Write Two Sentences
twice: the slowest question in the test, at three times the base pace. Same 60
questions, a worse test. Dropping from the existing ranking keeps the order the
run already had. Measure the shape of the run, not just its length.

The repeats that remain are not padding, and this is the answer to "why am I
still copying a name twice". Copy the Name claims Stage A features ("Copies first
and last name") and Stage B ones ("Writes full name accurately", "Leaves spaces
between words", "Uses upper and lower case"). Stage B is closed the first time,
because the learner has not shown Stage A yet, so the second ask is the Stage B
observation. Crediting the first answer retroactively once Stage B opens would
collapse these, and would also collapse three signs into one and three messages
into one, which is rule 8 in reverse: one observation standing in for two stages.
The repeat is the staircase confirming, not the picker wasting.

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

It was reported anyway, from a screenshot of a run with nothing wrong in it:

> "Change the wording to at least PLB.03. Generally, when there is no wrong
> answer, all indicators say at least, right now only some say it."

`row.capped` was `demo===meta.ceiling`, and `.03` `.04` and `.08` declare a
ceiling of L1 they can never be awarded, because every Level 1 claim in the app
is partial. So they reached PLB, `capped` stayed false, and the row read
"PLB.03 / Working towards Level 1.03" over a perfect performance.

The bar is `acsfAwardCeiling`, which is rule 8a's bar: the highest level, within
the declared ceiling, carrying one piece of evidence the app does not itself call
partial. It lives in the app now and `reachable` calls it rather than keeping its
own copy, because a verdict and the bar it is judged against are exactly the pair
that must not drift. `reachable` also asserts the wording, not just the level.

The lesson underneath: **a declared ceiling is what the app aims at, not what it
can hit.** Anywhere the two are treated as the same thing, the difference gets
printed as something the learner failed to do.

### 8d. The report can show its working, and the working is what the learner saw
*check: `evidence`*

> "The final report should have an option to show evidence from the test: the
> results are accompanied by the questions that were used and the user's
> answers to those questions. Printable."

A verdict a teacher cannot argue with is a verdict they have to take on trust,
and this one is produced by a phone marking itself. So the panel keeps the run
written down: every question in the order it was asked, what was on the screen,
what was said out loud, what was on offer, what the learner answered, and the
features that answer was counted against. `TEST.ev.qs` holds it, which means it
rides along with the evidence into storage and comes back with the profile after
a reload.

Three things decide whether it is worth having:

- **It prints what the learner saw.** `questionShown` is the one place that
  decides how a question is worded, and both the answer screen and the evidence
  list read it. A transcript that worded a question its own way would be a
  second account of the run, and the one a teacher could check against the
  learner's memory is the screen.
- **It names only features that were really credited.** `acsfCredit` hands back
  what it wrote against, gated stages and all, rather than the list being worked
  out again beside it. The claim map says what a step could show; only the
  crediting knows what this run let it show, and printing the first as evidence
  would be putting working on the page that never happened.
- **It is a choice on the screen, and never on paper.** Shut until the teacher
  asks for it, because the profile is what most readings of the page want and
  sixty questions under it is a lot of scrolling. Copy follows the screen for
  the same reason: a paste into an assessor sheet is rarely the place for the
  whole run. Printing does not. The sheet is the copy that gets filed and taken
  to the learner, and a teacher who presses Print has asked for the report, not
  for half of it, so it carries both halves every time. The screen says so
  above the buttons rather than leaving the printer to say it.

The transcript is also most of what a saved run weighs. When the device has no
room left, `acsfSaveRun` gives the transcripts back one at a time, oldest first,
rather than losing five profiles to keep one transcript.

### 8e. The report is a document on paper, not a screenshot of an app
*check: `printable`*

> A print preview from an iPhone, four indicators drawn on top of each other
> and the right-hand side of the sheet cut off. "Fix print."

The panel is the one screen here meant to leave the device, and printing it is
not the same as showing it. The app is a fixed-height thing that scrolls inside
itself, built of nested flex columns; a printer wants one column as tall as it
needs to be, cut into pages. Everything between those two is what the print
rules undo, and undoing it by halves is what produced that preview.

Three faults, and each is now a line in `printable`:

- **A flex box that meets a page edge.** Safari does not fragment a flex
  container: where one crosses a break it draws the rest of itself over the top
  of the next page. `.acsf-wrap`, `.acsf-body` and `.acsf-evidence` are column
  stacks and nothing more, so on paper they are blocks and their `gap` becomes
  a margin. A flex row short enough to sit inside a block that never breaks
  cannot meet a page edge, so the rule is about the tall ones, and the check
  reads heights rather than banning flex.
- **The phone's own height and clipping.** `--app-h` is measured in JS and sits
  on `body` and `.screen` as a `min-height`; `body` also carries
  `overflow-x:hidden`. On paper that is a blank half-sheet wherever the height
  lands and a cut-off right-hand side wherever the paper is narrower than the
  phone. Both are undone for the whole chain, not for the panel alone.
- **Holding a whole skill group together.** `break-inside:avoid` on a group of
  three or four indicators asks for something that often cannot be given: the
  break goes in front of the group anyway and the page before it ends a third
  full. What is worth keeping whole is an indicator with its features, a
  question with its answer, and a heading with the row beneath it.

One more, found by the check rather than by the report: the rule that makes
those three blocks `display:block!important` on paper also beat the browser's
own rule for the `hidden` attribute, so the questions printed for a teacher who
had never opened them. Anything `!important` enough to change layout is
`!important` enough to resurrect something hidden.

### 8f. The same test, whoever pressed Start
*check: `classroom`*

> "Check level check in teacher mode. Is everything updated and working like the
> solo games? I have only worked on the solo mode recently."

Nothing was. A teacher could pick Level Check in the class lobby, press Start,
and every phone in the room sat on the waiting screen: `startStudentTest`
refused any test with no ladder, and a level check has none by design. The ones
that would have started were worse than stopped. The seconds came from a box
solo seeds from `defaultSecsFor` and the teacher's lobby never did, so the same
assessment ran on 40 seconds alone and 30 in class, and the report prints the
timeouts that buys as something the learner could not manage. The card at the
end carried the button to the profile only on the ending a learner reaches
alone, so a run sat in class was saved to the device where nothing could open
it, which is the whole of what a class sits a level check for. The teacher's own
two screens described Test Yourself: ten rounds of three from every game, a rod
filling against a round count the check runs straight past, "17/10" beside a
learner's name.

One cause under all of it. Every decision made about the level check since it was
split out of Test Yourself was written into the solo path, and the class path
still held the shape of the game it was forked from. **The mode decides who
pressed Start. It decides nothing else about the test**: not the questions, not
the clock, not the length, not where the evidence ends up. Anywhere the two
paths work something out separately, they will drift, and the one nobody is
looking at is the one that rots.

The parts that genuinely differ are few enough to name: the room resets the
scores and says go, the teacher watches a track instead of answering, and the
class ending waits on the projector. Everything else reads one function. The
teacher's screens read `gameInfoFor`, the same name and blurb the learner's start
card shows, rather than a third description written beside them; both pickers read
`baseSecsFor`; both endings carry `.test-acsf-btn`.

One thing the class path cannot share, and it is worth knowing why. A level check
holds its staircase and its evidence in memory, and the room stores neither, so a
phone that reloaded part-way has nothing to resume from. It sits the check again,
from round one and nought points. Carrying on from the published round number
would deal every skill from its first stage again and then stop early against
`TEST_ROUNDS`, which belongs to the other test: a short run wearing a full
profile's clothes.

**Still open, and a teacher's call rather than a bug.** The class ending ranks
the room on the points a level check happens to score, podium and all. Points are
already the learner-facing frame in solo, so this is the class-game ceremony
applied consistently rather than something teacher mode invented, but an
assessment projected as a leaderboard is a different thing from a game projected
as one.

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
- **In the picture.** Safe or Private drew its icon from the answer, 🙂 for safe
  and 🔒 for private, over two options. The padlock was the answer printed above
  the question, and every rule here read the speech and the options and none of
  them had ever looked at the icon.

  The rule is narrower than "the icon must not predict the answer", because where
  the picture **is** the question it predicts the answer and is right to: Devices
  shows a keyboard and asks what it is called. The tell is a round whose written
  question already carries the item, and whose pictures are fewer than its
  questions and line up one for one with the answers it has to give. That is a
  picture of the answer and nothing else, and it is what `leaks` holds now.

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

It was reported a second time from the other end, as a question about difficulty
rather than about repetition:

> "How much are other skills like reading and listening involved in answering the
> digital literacy questions?"

Devices chose between naming a device and saying what it is for on `i%2`, so the
pool step that carries "Begins to understand the purpose of some commonly used
digital devices and software" at both `.12` and `.13` dealt the naming round on
every run, and `acsfNoteAsked` marked both features shown off the answer. Not a
repeat this time, and nothing on the screen looked wrong: the report a teacher
read simply said something about the learner that had never been asked.

`rounds` is the check, and the reason none of the others caught it is the lesson:
**`options`, `integrity` and `spread` all deal a pool step eight or twenty
questions at a time, and a run deals it one.** Dealt eight, every one of these
banks looks right. So the check deals each step forty times at one question and
four times at twenty and compares: a round that is a third or a half of a long
draw and never once appears in a single draw is a round chosen by the draw index.
The share is what keeps a bank of a hundred prices out of it.

It found the same fault in eight more banks in one run, which is rule 20 working.
The fix divides in two, and which half applies is decided by the claim map, not by
the bank:

- **Where the claims differ per kind, `from` names the kind** and `byFrom` splits
  them. Put In Order claimed "Orders days of the week and months of the year" off
  a step that could only ever deal numbers. Big and Small Letters and Capitals and
  Full Stops both had a pool step declared as the writing one that dealt the
  tapping round. All three were excused in a comment for showing "both halves in
  one round", which is true of a ten question game and false of a level check.
- **Where one feature covers every kind, the kind is drawn rather than indexed**,
  so a single draw can be any of them. Which Comes First only ever asked for the
  first word, Tens and Ones only the tens, Find the Date only the day, Write the
  Number only the number, Read the Notice only the heading, and First, Second,
  Third only the half that is not the spoken one its feature names.

### 12c. An option a learner cannot read is not a question about the indicator
*check: `options`*

> "Written options on listening, numeracy and digital items. A PLA learner
> cannot read Goodbye / Please / Good morning, so reading failures are recorded
> against .08 to .13."

Every round outside Reading was answered by reading its options: a greeting
with four written replies, a picture of a laptop with *charger / mouse /
laptop / camera*, an arrow with *left / behind / up / right*. A learner at
Stage A cannot read any of it, so the wrong answer went down against listening,
numeracy or digital when what failed was reading. Every indicator was
confounded with `.03` and `.04`.

`q.hearOpts` puts a chip on each option that speaks it. The option's own tap
still answers on the first tap, which is the contract every round has, so the
chip is a plain span inside the button that stops the click from reaching it.
It does not count as a replay: `TEST.ev.replays` stands for asking to hear the
**question** again, which is one of the three things `.02` reads as a learning
strategy, and hearing an option is reading help.

**The flag is set by the round, not worked out from the indicator**, and this
is the part to get right. Whether hearing an option hands the answer over is a
fact about the round: on a greeting it is the help a Stage A learner needs; on
Sight Words, where the task is to match a word you have just heard to the way
it is written, it *is* the answer. Same for Letter Names, Tap the Number, and
the ordinals round that says "Tap the first one" out loud. Where a bank already
puts a picture on the option, as Listen and Do does through `q.art`, the
picture is the help and the chip would be the leak.

**The prompt is the same rule seen from the other side**, and it was reported
separately:

> "What about 'smallest to biggest'. Shouldn't the instructions be read to the
> user?"

Put In Order showed its instruction and never said it. A learner who can order
coins perfectly well had no way to find out that ordering was the task. Three
other rounds were silent the same way: Tens and Ones, Find the Date, and Copy
the Code.

Fixing those four bank by bank was the instance and not the rule, and the
reporter found the rest on the next run:

> "Also how many tens in ... If it's numeracy, it shouldn't be solely reliant
> on reading. How much is ... is also just text. The question should be
> spoken."

The rule is **every round reads its visible question aloud**, and it lives in
one line of `speechFor`. What was there said "a multiple choice round with
nothing of its own to say has nothing to say: there is no field below that
would be right to read out", and that is the mistake: there is one, and it is
`Q.question`. Reading it aloud cannot give anything away, because a learner
looking at the screen has it already. That is the same reasoning `leaks` uses
to allow a spoken prompt that matches what is written.

The instruction is not the text under test. The table, the sign, the message,
the model word and the calendar are, and they stay on the screen to be read.
Question Words is the one round still silent when tapped, and rightly: there
the question field is the gap sentence itself, so reading it out would be
reading the item.

`noListen` changed meaning with it. Seventeen rounds carry it, and every one
set it to stop the old guessing branches reading the wrong thing: the word you
are copying, the sentence you are ordering. None set it to keep an instruction
secret. It means "do not guess what this round would say" now, and the visible
question is still read. Banks that speak went from 40 to 53.

Put In Order was silent because it carried `mute`, which was the blunt way to
stop `speechFor` falling through to its unscramble branch, where it reads
`q.sentence` and `q.sentence` is the tiles already in order. Naming what to
speak, `say: prompt`, is the fix. Silencing the round was a rule about the
answer applied to the instruction as well, and `mute` has no users left.

The check holds three halves now: a round that speaks its options may not speak
its answer; a step whose claims all fall in `.08` to `.13` may not leave an
option that can only be read; and such a step says what to do out loud. The
last of those is a floor under the `speechFor` rule rather than the whole of
it, because the pool is not every round in the app. A
numeral, a time, an amount and an ordinal symbol are not reading: recognising
them is the numeracy feature itself, which is also why Tens and Ones speaks its
question and not its options.

The same report turned up two more faults in the same round, which is the usual
shape. Ordering 5c, 10c and 50c was being credited to a Stage A feature whose
own words are "whole dollar notes and coins up to $10", and the `register` rule
that catches "$6.50" had missed "50c" because it read only for a decimal point.
And the four options were "3 9", "9 3", "I was tired on Sunday night." and
"She is from Vietnam too.": two tiles have only two orderings, and
`buildOrderChoices` padded the rest out of `poolFor(q.type)`, where `q.type` is
the *shape* of the question and not the bank it came from. For Put In Order
that shape is `unscramble`, so the padding came from the sentence bank. Three
options that are not orderings at all point at the answer as plainly as any
spoken leak, and `leaks` now holds that every option of an ordering round is
the same tiles in a different order. A round with two real options offers two.

Removing that padding uncovered a third: `buildOrderChoices` told its options
apart by the raw string while the answer is marked with `normalize`, and for
number tiles those disagree. "3 33 63" and "33 3 63" are different orderings
and both normalize to "33363", so one of the wrong options was marked correct.
It is rule 9's "$3.20 and $320 are one option" in a bank nobody had looked at
for it, and it is why options are deduped the way they are marked.

It also caught what the report did not mention. "Good morning." was answered by
"Good morning." was answered by the greeting handed straight back, so the
option gave itself away in text before audio was ever added, and it was the one item a chip could
not be given. It is asked the way it happens now: *You arrive at class in the
morning*.

### 12f. A chip on the option moves the confound, it does not remove it
*no check, judgement. The measurement below is the method*

> "How much are other skills like reading and listening involved in answering the
> digital literacy questions? Aren't the questions too difficult and dependent on
> things other than digital literacy?"

Rule 12c put `q.hearOpts` on every option outside Reading, so nothing has to be
read. What it did not do is make anything shorter. Count what a learner has to
take in to answer one question, the spoken prompt plus every option, because an
option that is heard is an option that has to be held:

| round | before | after |
|---|---|---|
| Name the device | 8 | 8 |
| Screen symbols | 10 | 8 |
| Safe or private | 16 | 7 |
| What is it for | 24 | 8 |
| Notice, what should you do | 26 | 17 |
| Device problem | 29 | 8 |

Twenty-nine words is "The screen is black and it will not turn on. What is wrong?"
over four options like "It is upside down". The band it was testing says, at `.08`
Stage A, "Understands extremely familiar social exchanges using single words", and
at Stage B "phrases and occasional, extremely simple sentences". `prompts` claims
only `.13`, so a learner who lost it on the English had that written down as a
digital literacy failure and nothing else: every indicator confounded with `.08`
this time instead of with `.03` and `.04`.

The fix is the one Listen and Do already used: **say it once, answer it with a
picture.** "Which one do you use to take a photo?" over four device drawings asks
the same thing as four written purposes and costs a third of the words. Where a
bank had no picture for an answer, `INSTRUCTION_ART` usually already did.

Two things this rule is not:

- **It is not a word cap.** Run the same count over the whole pool and the
  heaviest rounds left are Read the Sign, Screen Messages, Read the Notice,
  greetings and the punctuation round, at 12 to 27 words. In every one of those
  the text **is** the thing under test, and `.13` PLB 5 names it outright:
  "digital prompts or alerts, **texts** and symbols". So the notice keeps its
  dialog and its 17 words, and only its register was trimmed.
- **It is not about making questions easy.** Safe or Private went from "Safe to
  share" against "Keep it private" to yes and no with a thumb on each, and the
  judgement it asks for did not change. What went was the English wrapped around
  it.

The general rule: **when an indicator's questions are the longest in the test, the
indicator is measuring the length.** Count the words before arguing about the
wording.

### 12e. The register is named in the documents, not guessed at from word length
*check: `register`*

> "Level check asked me to type back and tie. Neither one is as common as pre
> level requires."

Both came out of a list written for this rule the first time round, which took
the themed spelling banks and kept their shorter words. Short is not the test.
A bank of fruit, clothing, weather and body parts is not the vocabulary the
framework has in mind however hard it is filtered, and filtering it produced
"back", "tie" and "hip" in place of "necklace" and "humid".

The document says what the register is, several times, and the words are worth
quoting because they settle the argument:

- `.06` Stage B: "Attempts to write extremely familiar, short words by sounding
  out and beginning to use sound-letter relationships, **e.g. big, fun, stop**"
- Reading sample activities: "Reads word on cue card with visuals ... **e.g.
  stop, go, car, dog**"; "Links extremely familiar everyday pictures and signs
  with corresponding words, **e.g. exit, hospital, no smoking**"
- Writing sample activities: "Copies appropriate word under picture, **e.g.
  pen, table**"
- And Binh, in the document's own scenario: "understood some words that were
  extremely familiar to him **stop, go, but not toilet**".

That is survival and classroom vocabulary, and the app already had a list of
exactly it: `COPY_WORDS`, the twenty words Copy It shows. Spell a Word dictated
those and nothing else for a while, on the reasoning that one register serves
both rounds and one list is one thing to change.

The register was right and the sharing was wrong, which the next report found:

> "I saw the word rent in listen and spell it. Isn't that still too hard for
> pre-level?" · "Please remove. Only ask: pen, pencil, home, name, bus. This is
> enough for spelling."

`rent` is in fact one of the easier words there, four letters and four sounds
with the same final blend as the document's own example `stop`, and it is
survival vocabulary for anyone renting here. What the question exposed is not
the word but the sharing: **the same word is a different question in each
round.** Copy It leaves it on the screen and asks for it letter by letter;
dictation says it once and takes the screen away. A register that is right for
the easier task is not automatically right for the harder one, and the feature
this round claims names its own size as well as its own register, "a very
limited number of extremely familiar words, which may have spelling
inaccuracies". `SPELL_WORDS` is that number: five, classroom and survival, and
`COPY_WORDS` keeps all twenty for the round that shows them.

Two things about that feature are worth keeping in mind before this list is
narrowed or widened again. A near miss is not a fail, because "may have
spelling inaccuracies" is in the feature and `spellTier` marks it partial. And
phonic regularity is not the bar the feature sets: half of `COPY_WORDS` cannot
be sounded out letter by letter (`city`, `name`, `home`, `time`, `work`,
`door`, `open`, `exit`), and trimming a list to the words that can would be a
stricter rule than the checklist asks for, which is the mistake this rule was
written about in the first place.

The standalone game still holds every themed word. A game is for practising the
hard ones; an assessment is not, which is the same answer rule 12 gave the
elementary sentences and rule 12a gave subtraction.

**The general rule: when a report says content is above the band, go and read
what the band says, and take the register from its examples rather than from a
proxy like length.** Length was already rejected once, in rule 12, for the
opposite reason.

Spell a Word lost its Stage A claim at the same time, and that is the half
nobody reported. Its wording is "**Copies** a very limited number of highly
familiar words, but may have spelling inaccuracies", and this round dictates:
there is no model on the screen to copy from, and hearing a word and writing it
is the harder task. Copy It carries it now. A claim whose first word describes a
different task than the round performs is rule 5 wearing different clothes.

Moving it broke `reachable`, and fixing that turned up a second fault
underneath. Both are worth knowing.

The one the check caught: every remaining `.06` Stage A claim was marked partial, so the stage
could not be awarded to anybody and `.06` stopped at Stage A on a perfect run.
That is rule 8a, and the check caught it the same day it was written. The row
is not partial on Copy It. The flag on its neighbours says a copy made on a
keyboard is not a copy made with a pencil, which is a fair caveat about the
checklist's **Legibility** features; this row sits under **Spelling**, where
the concern is whether the letters come out right, and a keyboard shows that
exactly. Spell a Word had carried it unflagged for the same reason.

The one found while fixing it, which no check holds and which is why it is
written down here: `partial` was whichever claim reached the feature first. Two steps
can show one feature and disagree about it, and "Copies text, but demonstrates
lack of consistency between upper and lower case" is claimed partial by Copy It
and solid by Big and Small Letters. Whichever was dealt first set the flag, so
whether `.06` could be awarded turned on the order of the deal. A feature stays
partial only while every step that showed it was partial. `acsfAwardCeiling`
already read it that way off the claim map, so the verdict and the bar it is
judged against had drifted, which rule 8c says is the pair that must not. With
the row above made solid, `reachable` passes either way, so this one is a
latent fault put right rather than a failure repaired: the next claim map
change could have landed on it.

### 12d. A wrong answer at Stage A earns one second ask
*check: `retry`, and the run lengths under `run` and `spread`*

> "Ask each PLA feature twice. Do it only when the learner cannot answer
> correctly the first time. Today one slip on a three-feature stage closes the
> indicator at NYA."

A stage is judged at three quarters. A Stage A stage of three features with one
wrong answer is 2 of 3, which reads `part`, and `acsfReviewStages` closes the
indicator there: reported NYA, and never asked Stage B. One mistap ended an
indicator.

**A second ask is not a second observation. It is the same observation,
revised**, and the better of the two attempts stands. That is not generosity.
The whole of Pre Level 1 is described as performance with support. The
Performance Variables Grid puts the learner "with an expert/mentor where highly
structured support and modelling is provided", and the Stage B features
themselves read "may require prompting". A second ask is the prompt, and
`acsfWhyCount` prints "on the second ask" so a teacher reads what happened.

Revising rather than appending is also what keeps the evidence one observation
per feature, which is rule 3's shape and what `acsfEvidenceAt`'s `full` test
depends on. It is scoped to `q.retryOf`: the repeats the run makes on purpose
(rule 5b) keep accumulating.

What does not earn one, each for a reason already in this file:

- A blank or a timeout. No answer is not a wrong answer (rule 4).
- A partly correct answer. It is already worth half, and the `sloppy` run is
  partial nearly everywhere, so retrying partials would re-ask most of the
  typed rounds in the test.
- A round whose answer cannot change between two asks: My Learning, and any
  declined answer (rule 5a).
- Write Two Sentences, by name (rule 5b).
- Stage B. That is the stage a learner reached by showing Stage A, and the
  question there is whether they can go further, not whether they slipped.

One per feature ever, which is what makes the run terminate.

**The trap.** A feature is marked asked the moment it is dealt, so the stage
reads as fully shown in the very round the learner got it wrong, and
`acsfReviewStages` would close it before the second ask was ever put to them.
A stage with a second ask still owed is not finished being asked, and the
review skips it. Without that line the retry queue is built, drained and
ignored, and nothing about the verdict changes.

Run lengths say it is working: a perfect run and a sloppy run are unchanged at
60, because neither produces a wrong answer; a run answered wrong throughout
goes from 17 to 34.

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

### 13a. A price is one the thing could cost
*check: `prices`*

> "Pay 3 dollars for shoes. Shoes should be changed with tea. Shoes being $3
> doesn't make any sense."

One word in one round, and underneath it every Stage A money question in the
level check. `SHOP_ITEMS` was ten things that cost tens of dollars, drawn at
random against a price the round had already set, and Stage A pays one to nine
whole dollars because its features say "whole dollar monetary amounts up to
$10". Shoes for $3, a bicycle for $5, a chair for $2.

A price an adult cannot believe stops being a question about recognising money
and becomes a puzzle about what the app meant, which is the same fault as an
option a learner cannot read: the question is no longer about the thing it is
evidence for.

Read the List had the rule already and the comment to go with it, capping its
groceries at $20 because "$98 for a loaf of bread would be the first thing an
adult noticed instead". A cap is enough there, where the bank only names
groceries. Shop pays up to $99.50, so each item carries what it plausibly
costs and the round names something that fits the price: groceries under $10,
the things a household buys once above it.

The half of this worth remembering is the gap. Ranges that cover the prices you
were thinking of leave seams where the ones you were not thinking of land, and
a seam is not a visibly wrong question, it is the nearest fit quietly standing
in for one. `prices` walks every fifty cents from $1 to $100 and found $9.50
between the groceries and everything dearer within a minute of being written.

### 13b. An amount is marked as an amount, not as letters
*check: `money`*

> "I just saw one question in level check, that had a 2 dollar coin, and only
> accepted 2.00 as the answer, not $2 or 2."

`normalize()` is the app's "same letters" test and it was marking money. It
strips the dollar sign and the decimal point, so `2.00` arrives as the digits
`200` while `2` stays `2`, and a learner who wrote the right amount was marked
wrong, scored nothing, and had `.09` and `.11` recorded as not shown. The
comment above `moneyAnswer` said the sign did not matter because normalize
strips it, which is the half of it that is true: it makes `$67.50` equal
`67.50`, and it never made `2` equal `2.00`.

`moneyCents` reads an amount the way somebody writes one, and `moneyTier` marks
two amounts the same when they come to the same number of cents. Every round
that takes a typed amount carries `q.money`, which is what reaches the marker
before the `typein` guard, so the shop rounds are included too.

The instance was one coin and the rule was in four rounds, each wrong in its
own direction. Add the Money was the mirror image: its answer is `8`, so `$8`
was right and `8.00` was wrong. The dictated round says "two dollars" and took
only `2.00`. The 50c coin took only `0.50`, never `50c`.

**A bare number is dollars, and that is a judgement worth keeping.** `50`
against a 50c coin is half marks, not full: the numeral was read and the unit
was missed. Marking it right would be kinder for one question and would stop
the round measuring what it is evidence for, because four of the ten
denominations share their digits with another one and telling a 20c coin from
a $20 note is the performance feature. This is rule 9's shape seen from the
marking side: an answer that cannot be got wrong is not evidence.

**The example under the box is a promise.** The round printed `e.g. 2` and
then marked `2` wrong, which is rule 16a ("an example scores full marks under
its own rule") one step earlier: a placeholder is an example too. `money`
rebuilds each question's amount in the shape its own placeholder shows and
requires that shape to mark correct.

The last part of it is rule 8f again, found while fixing this. The class path
had its own `normalize(a)===normalize(b)` and never reached the tier ladder at
all, so the same answer was worth different things depending on who pressed
Start. `answerTier` is the one place now, read by the phone alone and the phone
in a room, and by the check harness, which had been keeping a third copy of the
rule inside its own simulated learner.

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

### 14a. A sign is drawn the way Australia draws it, carries no words, and has one reading
*check: `signs`*

> "Some of the signs in level check and the game are different from Australian
> signs and may be interpreted in different ways. They can be especially
> challenging for pre learners who do not work on them."

Rule 14 asks whether a picture is the thing it names. A sign asks something
harder, because a sign is a convention before it is a picture, and a learner
who has not been taught the convention has only the drawing to go on. Three
separate ways it was failing, and the first is the one that generalises:

**The form was not the one on the street.** The prohibition band ran from lower
left to upper right on all three ring signs. ISO 7010 and AS 1319 run it the
other way. It was wrong three times because the line was written out once per
file, which is rule 20 wearing a protractor, and no rule here had ever looked
at a drawing at all. Everything above this line reads the speech, the options
and the question; the picture was only ever checked by eye.

**The drawing depended on a font.** No Parking set its P as a `<text>` element
in Arial, so a device without Arial substituted a face and the sign changed
shape. Letters and digits on a sign are paths.

**Words on the face of a sign are not a sign.** This one was already the bank's
own rule, in the comment above `SIGNS`: "a sign that says EXIT tests nothing,
but a green running figure asks the learner to read the meaning." It nearly
went the other way. The photographs these eleven were redrawn from are the real
Australian signs, and the real bus stop flag says **Bus Stop** across it. Drawn
that way, the question is answered by noticing that two strings look alike,
which is a different task from reading the sign, and a different task again for
a learner who has some letters than for one who has none: the same question
measuring two different things depending on who sits it. The flag keeps the
bus, the pole and the blank route panel, which is what makes it Australian, and
loses the two words. `signs` holds it so the argument is not had twice.

**An option that is also a reading of the picture marks a learner wrong for
reading the sign right.** This is the half of the report that is not about
drawing at all, and it was in five of the eleven. A green cross is what
Australian pharmacies put on the shopfront, and "Chemist" was on offer against
the first aid sign. A red disc says stop, and "Stop and wait" was on offer
against No Entry. A figure going over backwards says no running; a running
figure says do not run; and a vehicle drawn front on has a windscreen and
lights whether it runs on a road or on rails, so "Train station" sat under the
bus. In each one the learner who read the sign correctly could tap an option
that said what they had read, and have it written down against `.03` and `.04`
as a failure to read.

It is rule 13 in another bank and it takes rule 13's answer, because no script
can be told whether "Chemist" is a fair reading of a green cross: that is a
fact about Australia, not about the file. `signs` carries the reviewed option
set for every sign, and changing an option or adding a sign fails until
somebody has looked at the drawing again and written the new set down. The
judgement still has to be made. It just cannot be skipped.

**What is still true after all of that, and is judgement.** Two of the eleven
are not wholly symbolic and cannot be made so without ceasing to be the
Australian sign. No Parking cannot be answered without reading a Roman letter.
No Food Or Drink names a drink its picture does not show, because the real sign
puts that in words underneath. Both are kept, because the alternative is
teaching a learner a sign they will not meet, and both are worth knowing about
before reading anything into a wrong answer on either.

"Restaurant" under No Food Or Drink was looked at and kept. A knife and fork on
its own does mean a place to eat, on the service signs along a highway here,
but the band is drawn across this one and the band is the whole difference
between the two readings. An option that is only a reading of the picture with
part of the picture ignored is a distractor doing its job.

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
