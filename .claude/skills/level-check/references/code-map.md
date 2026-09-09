# Where the Level Check lives

`game.html` is one file of about 11,200 lines with no build step. Line numbers
below are a starting point, not a promise. Grep for the name if the line has
moved. Everything about the assessment is prefixed `acsf` or `ACSF_`, so
`grep -n "acsf" game.html` is the fastest map there is.

A level check is its own game type, `test:level`, with its own tile on the home
page and its own short address `/level-check`. It is not the same thing as
"Test Yourself", which is `test:*` and `test:<section>` and runs a band ladder
rather than a staircase. A change to one is not automatically a change to the
other, and `variants` is the check that says so.

## The shape of a run

```
newTestGame('solo','test:level')        8478   makes TEST, including TEST.plan
  acsfNewPlan                           7697   every indicator starts at its first stage
testStartRound                          8618   picks the round's steps and deals them
  acsfPickNext(3)                       7753   which steps to ask next
  testQuestions(step,1)                 8610   deal one question from a step
  attachMcChoices(qs,type)              4874   options are attached here, not by the bank
  acsfNoteAsked(step)                   7853   mark the features it just showed
testRecord(tier,pts,timedOut,ans)       8656   one answer
  answerGiven(q,ans)                    8589   was anything actually entered
  acsfNoteMode(q)                       8596   how the learner answered
  acsfCredit(step,tier,q,ans)           8526   write evidence against features
testEndRound                            9225   close stages, decide whether to stop
  acsfReviewStages                      7802   a stage is done when it is shown or failed
testFinished                            8503   nothing open, or the guard is reached
acsfProfile(ev,true)                    9017   turn evidence into the report
  acsfSignalRows(ev)                    8794   the whole-run signals for .01 and .02
  acsfRow(ind,byInd,sig)                8923   one indicator's verdict, level by level
  acsfLevelState(s,meta)                8774   yes / part / no at one level
openAcsfPanel / renderAcsfPanel   9109 / 9127   the teacher screen
acsfCopyText(prof)                      9034   the copyable report
```

## The claim map

`ACSF_CLAIMS` (7311) is the heart of it. Each row is

```
[indicator, level, verbatim performance feature, partial?, exactOnly?]
```

keyed by step type. Two ways a step's claims can vary:

- `byFrom` splits claims by round kind, because one bank deals several
  different rounds. Copy It at `from:0` is copying a word, at `from:1` a name,
  at `from:2` a number, and they do not claim the same feature. This is what
  `acsfClaimsFor` (7552) resolves. Getting it wrong is what produced "why did I
  get five copy-a-word questions?": the picker thought a step was still owed
  when the round had already credited it.
- `ACSF_RANGED` (7547) splits by PLA versus above, where the same round is
  evidence of different things at different stages.

A question can also carry its own `q.acsf` claims and `q.declines`, for banks
where the round decides rather than the step.

## The staircase

Replaced a single global band ladder. Every indicator walks its own stairs:

```
ACSF_STAGE_ORDER = ['PLA','PLB','L1']       7665
acsfFirstStage(ind)                         7705   where an indicator starts
acsfNextStage(ind,lvl)                      7714
acsfOpenStages()                            7725   what still needs asking
acsfStageOpen(ind,lvl)                      7845   may this be asked, and credited
acsfStepValue / acsfStepTops         7741 / 7774   which step best serves what is open
ACSF_MERCY_QS = 3                           7801   how much rope before a stage closes
ACSF_MAX_QUESTIONS = 150                    7669   the guard against a bank that cannot deal
```

The rule that gives this its shape: an indicator is asked *every* feature of
its current stage, and only climbs when it has shown that stage. A learner who
cannot do PLA.03 is never asked PLB.03. `acsfStageOpen` is enforced in two
places, when picking (`acsfPickNext`) and when crediting (`acsfCredit`),
because gating the pick alone was not enough: a step picked for one indicator
still credited every other level it happened to claim.

## The pool

`ACSF_POOL` (7618) is the list of steps a level check may draw on, each
`{type, mc, from}`. Its comments record what is deliberately *not* there and
why: the elementary sentence bank, Grammar Unscramble. Read them before adding
anything back.

## Shared machinery a level-check fix keeps landing in

These are not assessment code, but a level check runs on them, so a fix here
changes every game:

| what | where | why it matters |
|---|---|---|
| `normalize(s)` | 10525 | the app's "same letters" test. Strips everything but a-z0-9, which is why `$3.20` and `$320` were once the same answer |
| `typeinTier(q,ans)` | 10540 | correct / partial / wrong for a typed answer, including capitals, spacing and sentence counting |
| `speechFor(Q)` | 9943 | the single answer to "does this round speak, and what". The replay button is shown iff this is truthy: one decision, one place |
| `showStudentQuestion` | 9489 | draws the question; line 9521 is the replay button |
| `renderMcChoices(q)` | 9621 | draws tapped options, including whether they get pictures |
| `attachMcChoices` | 4874 | puts options on a question at round time |
| `answerPace` / `answerSeconds` | 4986 / 5002 | how long an answer gets, as a multiple of the base. `ACSF_SECS` is 40 |
| `drawGen(type,n,from)` | 4785 | the dealer for generated banks, including no-repeats |
| `genDistinctCount` / `countFor` / `countLine` | 4710 / 4704 / 4700 | how many questions a bank really has, and what the launch screen says |
| `emo(word)` | grep | the word-to-picture map |
| `GAME_INFO` | 7991 | each game's skill and blurb |
| `BANK_SECTIONS` / `TEST_LADDERS` | 6924 / 7015 | the ordinary Test Yourself path |

## Games the level check draws on

The pool is about fifty steps across roughly thirty-six games. When a report
names a game, `node tools/checks/check.js probe <bank>` prints what it deals,
and `grep -n "'<bank>'" game.html` finds its bank function, its `GAME_INFO`
entry, its `ACSF_CLAIMS` row and its pool step in one go.
