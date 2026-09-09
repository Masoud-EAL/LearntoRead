# LearntoRead
Learn to Read teaches adult learners to read English through phonics. Four sections: Alphabet (letter names), Letter Sounds (tap words to hear them), and two Word Pronunciation levels covering short vowels, digraphs, blends, and spelling patterns. Audio at three speeds. Emoji icons. No app needed.
With a multiplayer classroom and solo game mode

## Working on it

Static HTML with no build step. Pages publishes the repo as it stands, so what
is in the tree is what ships. To see a change, serve the folder and open it:

```sh
python3 -m http.server 8000
# then http://localhost:8000/index.html
```

`file://` will not do, because the app fetches `i18n.js` and its audio, and the
service worker needs an origin.

Some files are generated. `tools/build-links.py` writes the short share pages
(`/clock`, `/speaking`) plus `sitemap.xml` and the list in `sw.js`. Edit the
lists inside that script rather than the pages, run it, and commit what it
produces.

### Checks

`tools/checks/` holds a suite that drives the real app in a headless browser:
that every game deals, that no question gives away its answer, that the Level
Check reaches a defensible result, that nothing repeats.

```sh
node tools/checks/check.js              # everything, about three minutes
node tools/checks/check.js audio        # one check
node tools/checks/check.js probe signs  # print real questions from a bank
```

Exit code 0 means clean. It needs Playwright somewhere node can see it and
nothing else. There is no `package.json` here on purpose.
`tools/checks/README.md` says what each check proves and which bug report
earned it.
