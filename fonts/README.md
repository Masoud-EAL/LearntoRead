# Self-hosted fonts

These woff2 files are subset from Google Fonts (Nunito, Fredoka One) and the
Noto family (Arabic, Nastaliq Urdu, SC, Khmer, Myanmar, Devanagari), all
licensed under the SIL Open Font License 1.1 (see LICENSE.txt).

Each file only contains the glyphs actually used by this app:
- `nunito-*.woff2`, `fredoka-one-400.woff2`: full Latin + Latin Extended
  (covers English UI text and Vietnamese diacritics).
- `noto-sans-*.woff2`, `noto-nastaliq-urdu-*.woff2`: subset to the exact
  characters that appear in `translations/*.json`, plus common digits and
  punctuation.

Regenerate with `fonttools`'s `pyftsubset` if `translations/*.json` gains
characters outside the current subset (missing glyphs will fall back to the
browser/OS default font rather than break, but may render inconsistently).
