# Self-hosted fonts

Only the core UI fonts are self-hosted here: `nunito-*.woff2` and
`fredoka-one-400.woff2`, subset from Google Fonts (Nunito, Fredoka One),
licensed under the SIL Open Font License 1.1 (see LICENSE.txt). They cover
full Latin + Latin Extended (English UI text and Vietnamese diacritics).

The translation-display fonts (Noto Sans Arabic, Noto Nastaliq Urdu, Noto
Sans SC, Noto Sans Khmer, Noto Sans Myanmar, Noto Sans Devanagari) are
**not** self-hosted — they're loaded from Google Fonts as before (see the
`<link>` in `index.html`). An earlier attempt to self-host pre-subset copies
of these broke text shaping for some scripts (e.g. Farsi ی), so translated
text now simply requires an internet connection to render in the correct
typeface; it still displays (via a system fallback font) if offline, just
not necessarily with correct joining/shaping for cursive scripts.

Regenerate the Nunito/Fredoka files with `fonttools`'s `pyftsubset` if the
app's English UI text starts using characters outside the current subset.
