---
name: level-check
description: Diagnose and fix a bug in the WordLink Level Check (the ACSF pre-level assessment in game.html): wrong or impossible results in the teacher report, a question that gives away its answer, a game repeating, a missing "Hear it again" button, a picture that is not the thing it names, wording above the audience, questions that are too hard or too easy for the band being tested. Use this whenever someone reports something they saw while taking the test on their phone, even when they describe it in plain language and never say "level check", such as a screenshot of the results page, "I got PLB but I answered nothing", "why did I get five copy-a-word questions", "the charger looks like an old plug", "it repeated a question". Also use it for a report about any game the level check draws on, since the fault is usually shared.
---

# Fixing a Level Check bug

Reports arrive the way a person talks: a screenshot from a phone, one sentence,
often no name for the screen it came from. They are almost never about only the
thing described. Nearly every one has turned out to be a single visible case of
a rule that was wrong in more places than the reporter happened to hit:

- "The charger still looks like an old plug": wrong in two banks.
- "Sight Words needs a Hear again button": missing on twelve banks, from one
  decision written out three times in three places.
- "Why did I get five copy-a-word questions?": the question picker's model of
  a step disagreed with what the round actually credits, so the staircase never
  recorded the step as done.
- "0 of 2 but PLB": two independent faults landing in the same screenshot.

Fixing only what was reported would have left every sibling live, and the
reporter finds the next one on their next run. So the work is: reproduce, find
the rule, fix the rule, sweep the class, verify, push.

## The loop

### 1. Take the report literally, then reproduce it

Read it as written. "Two must be enough" is a statement about the right number,
not a request to add a cap. "Camera is not a button" is about the question, not
the icon.

Then confirm it before touching anything:

```sh
node tools/checks/check.js probe <bank> 20
```

Three reports have turned out to be about a build that had not deployed yet,
and one was a misremembered word. `probe` prints what the bank really deals:
prompt, spoken line, options, answer, seconds, whether it speaks. If you cannot
reproduce it, say so and ask what the screen said, rather than changing code on
a guess.

For anything about results rather than a single question, run the level check
end to end instead:

```sh
node tools/checks/check.js run
```

### 2. Find the rule, not the instance

Ask two questions:

- What would have to be true for this to happen?
- How many other places share that?

`references/invariants.md` holds the rules this app is meant to obey, each with
the report that produced it. A new report is usually either a violation of one
of them or a new rule to add. `references/code-map.md` says where the level
check lives inside `game.html` so you are not re-deriving 11,000 lines.

The fault is almost always one of four shapes: the same decision written out
more than once and only one copy fixed; a claim about the learner that the app
cannot actually measure; a picker's model of a step disagreeing with what the
round scores; or a question that stops measuring anything because it hands the
answer over.

### 3. Where the report is about assessment correctness, go to the documents

Anything about levels, indicators, "0 of 2", PLA/PLB, or what a result means is
a question about the framework, not about code. `docs/acsf-coverage.md` holds
all 132 key performance features verbatim. `references/assessment.md` says what
may and may not be claimed, where PLA and PLB come from, and why some features
are marked not assessed.

The rule that matters most: **never invent, paraphrase or stretch a performance
feature to make the app look better covered.** A feature the app cannot measure
is left unclaimed and marked so.

### 4. Fix the rule and sweep the class

Change the one place the decision should live, then find everywhere the old
decision was repeated. The matching check is the sweep:

```sh
node tools/checks/check.js audio      # after anything about speech or replay
node tools/checks/check.js leaks      # after anything about a question giving itself away
node tools/checks/check.js repeats    # after anything about a question coming back
node tools/checks/check.js ordering   # after anything about levels
node tools/checks/check.js blanks     # after anything about credit for doing nothing
```

`tools/checks/README.md` lists all fourteen and what each proves.

If the report describes a fault no check would have caught, add one. A check
earns its place by failing on the real bug: reintroduce the fault, watch the
check go red, then revert and fix properly. A check that has never failed
proves nothing.

### 5. Verify

Run the whole suite, not just the check you were working on. Roughly three
minutes, and the fix that broke something else is the reason to.

```sh
node tools/checks/check.js
```

Exit 0 means clean. Then look at the change once more the way a reviewer would:
does it read like the code around it, and is the comment about *why* rather
than what?

### 6. Commit and push

Write the message about the cause, not the symptom. "Pressing Submit over an
untouched question is not an attempt", not "fix level check bug". Say what was
wrong, in one line, in the reporter's terms where you can.

Develop on the working branch, then fast-forward `main`. If `main` has moved,
**merge, never force**, because another session may be pushing to the same repo.

## Audience

From `CLAUDE.md`, and it governs every wording decision here: this app is for
**adult migrants in Australia at ACSF pre-level**, adults with little or no
prior literacy in any language. Not children. No mascots, no childish framing,
no congratulating an adult for tapping a button. Simplicity is for low
literacy, not low age; fine motor control is adult-typical, so tracing
tolerances tune for learning letter shapes, not for small hands.

Two house rules for anything written into the app or into a commit message: no
em-dashes or en-dashes, and no attribution trailers or tool names anywhere in
the repository.

## Reference files

| file | read it when |
|---|---|
| `references/code-map.md` | you need to find where something lives in game.html |
| `references/invariants.md` | always, at step 2. This is the payload |
| `references/assessment.md` | the report is about levels, indicators or what a result means |
| `../../../tools/checks/README.md` | you need to know what a check proves, or you are adding one |
| `../../../docs/acsf-coverage.md` | you need a performance feature verbatim |
