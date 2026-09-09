# What the Level Check may and may not claim

Read this whenever a report is about levels, indicators, what a result means,
or whether a game "counts" for something. It is the part that is easiest to get
subtly, confidently wrong.

## The sources

Every performance feature the app quotes comes verbatim from the AMES/SEE
Reporting Checklist in two Victorian course mapping documents:

- `22636VIC Course in Initial EAL Mapping` (08/09/2025)
- `22637VIC Course in EAL Mapping` (08/09/2025, updated April 2026)

These give the reduced list of **key** performance features, the ones the SEE
Program treats as demonstrable and assessable, which is exactly the set a game
can be built against. All 132 are in `docs/acsf-coverage.md` with the game that
shows each one.

The wording in `ACSF_CLAIMS` is the source text. It is also the text the
teacher panel prints as its evidence. So a paraphrase does not just weaken the
claim, it puts words in the framework's mouth on a page a teacher may act on.

## PLA and PLB are not official ACSF

This matters and is easy to miss. The national framework has **one undivided
Pre Level 1 band**. The split into Stage A and Stage B comes from the AMES/SEE
Reporting Checklist, which is what Victorian providers report against. The app
follows the checklist because that is what its teachers use.

Say "Pre Level 1 Stage A" in anything a teacher reads. Do not describe PLA or
PLB as ACSF levels in their own right.

## Ceilings

The checklist tables for Numeracy (`.09` `.10` `.11`), Learning `.02` and
Digital (`.12` `.13`) stop at Pre Level 1 Stage B. The app cannot award Level 1
for those however well a learner does, and the panel says so rather than
staying silent.

Every Level 1 claim anywhere in the app is marked **partial**. One round of one
game is not the sustained performance Level 1 describes, and a report that
said otherwise would be a report a teacher could not use.

## What is deliberately not assessed

- **`.07`, speaking.** Nothing here records or judges speech.
- **Handwriting and legible script.** That is `tracing.html` and paper.
- **Level 1 Writing, entirely.** It came out because the app could not measure
  it from the documents, not because it was hard. The instruction was: "Only
  include them if they can be assessed based on the documents I sent you."

When you cannot measure a feature, mark it not assessed. Coverage is not the
goal. A report a teacher can trust is the goal, and one invented claim costs
more than ten honest gaps.

## How a verdict is reached

Per indicator, per level:

1. `acsfCredit` writes evidence against each feature the step claims, but only
   where `acsfStageOpen` says that level may be credited for that indicator.
2. `acsfLevelState` turns a level's evidence into `yes`, `part` or `no`.
3. `acsfRow` climbs the levels in order, stopping at the first one not shown,
   and also stopping at a level that was never asked, when features exist there
   and the ceiling allows them. Nothing to climb on means nothing above it.
4. `ACSF_MIN_EVIDENCE` (3) is the floor. Below it the row reports what was
   seen rather than what the learner can do.
5. `.01` and `.02` also take whole-run signals from `acsfSignalRows`: how much
   of the run was attempted, how much timed out, how much was submitted blank.
   One observation per feature, not one per question.

## Reading a report someone has sent you

A screenshot of the teacher panel is a dense thing. What to look at first:

- **A level awarded without the one below it** is always a bug. See rule 2 in
  `invariants.md`.
- **"0 of 2" beside an awarded level** is the same bug seen from the evidence
  side.
- **"N of N" on a run signal after a run the reporter says they did nothing in**
  is rule 3 or rule 4, and possibly both at once. That exact screenshot was
  produced by two independent faults.
- **A row saying not assessed** is usually correct and deliberate. Check
  `docs/acsf-coverage.md` before treating it as a gap.
- **An indicator with far more questions than its neighbours** is rule 5: the
  picker and the round disagree about what the step showed.

## Run length

There is no fixed length, by design. Measured over full runs: 19 questions for
a learner who shows nothing, and 62 for one who clears every stage.
`node tools/checks/check.js run` prints both, so if a change moves them you
will see it. `ACSF_MAX_QUESTIONS` (150) is a guard against a bank that cannot
deal what a stage still needs, not a target.

> "I don't care if the test gets longer than 36 questions. For somebody who
> cannot answer questions at all, the test may be shorter."
