# CLAUDE.md — Game Training Sim.pente

Project owner: Riker (beginner Pente player, not a coder). He leads design and content review; Claude builds. Explain changes in plain language, not code jargon.

## What this is
A Pente training web app: bots at graded levels, an in-game coach, variants that each train a specific skill, and (later) game review, lessons and puzzles. Hosted on GitHub Pages: https://rikerstorm34.github.io/Sim.pente-/ — every push to `main` runs the tests and redeploys (`.github/workflows/pages.yml`). The repo is public. No accounts in v1: everything is saved in the browser's localStorage.

## Hard constraints
- **No build step, no dependencies.** Plain ES modules served as static files. Keep it that way unless there is a strong reason; Riker can't maintain a toolchain.
- `js/rules.js`, `js/variants.js`, `js/ai.js`, `js/coach.js` must stay DOM-free (they run in Node tests and in the Web Worker).
- Every rules change needs a test in `tests/`. Run `npm test` before committing.
- Lesson and rules text must be original writing. Never copy text or diagrams from Tom Braunlich's books.
- "Pente" is a Hasbro trademark: don't use the PENTE logo/box art; keep the non-affiliation note in the README.

## Design (approved by Riker)
- The board game, made modern: cobalt/periwinkle blue, aqua, an ivory board, amber (gold, moves first) and blue glass stones, a Greek-key frame band.
- Light and dark mode on every screen (`data-theme` on `<html>`, CSS variables in `css/styles.css`).
- Type: Marcellus (headings), Inter (body), JetBrains Mono (coordinates/data).
- Orange = threats, aqua/teal = good moves and chances.
- Phone: tap to preview, then confirm. Mouse: click places directly.
- Header shows "Sim.pente" on phones, "Game Training Sim.pente" on wider screens.

## Coordinates
19×19. Internally (x, y) with y = 0 at the top. Displayed as pente.org style: columns A–T without I, rows 1–19 from the bottom. Centre = K10 = (9, 9).

## Variants and their rules (from Riker)
Variants exist to train specific skills; each must ship with clear rules and a "Trains:" line.
- **Double Five (custom):** win with two fives that run in different directions (may share stones); a straight six+ counts as one five; a five is banked once made; or win with 8 captured pairs.
- **Five + Captures (custom; name unimportant):** win needs both a banked five and a capture target of 5, 8 or 10 pairs (setting). Assumed, unconfirmed: a five stays banked even if later captured from.
- Standard set: Pente (tournament rule), Keryo, Gomoku (exact five, no captures), G-Pente, Boat, Poof.
- Not yet built: D-Pente, DK-Pente, Swap2 (need a choose-your-side opening UI).

## Roadmap
1. ✅ Rules engine, playable board, basic bot, coach (milestone 1)
   - ✅ Every game (finished or abandoned) is archived with its full move list in `gts.history` (up to 300).
2. ✅ Engine v2 (2026-11-21): capture-aware VCF threat search, iterative-deepening alpha-beta with a transposition table and time budget, 5 levels (Pip, Juno, Ludo, Vega, Orion). Each level beat the one below in test matches (9–1, 10–0, 5–3, 4–2). Hints use Vega (L4).
   - ✅ Stats screen (`#/stats`, `js/stats.js`): win rate, streaks, by opponent/variant/side, endings, captures (replayed from saved moves).
3. Game review: winning-chances graph, move labels with reasons, key moments with retry (the evidence-backed core)
   - Riker's request: a **game archive** to browse, replay and analyse ANY past game (data already saved since 2026-11-21).
4. Lessons (rules → shapes → captures → initiative → openings → threat sequences → endgame)
5. Puzzles from the player's own mistakes, spaced repetition
6. Remaining variant openings (D-Pente, DK, Swap2); multiplayer is deferred

## Requests from Riker (2026-11-21), not yet built
- ✅ **Quiet coach** (built 2026-11-21): modes Quiet (default; notes and board markers hidden behind a "Coach has N notes" button, re-hidden each turn), Always show, Off.
- **Connect6:** first player places 1 stone, then players alternate placing 2 stones per turn; six or more in a row wins; no captures. Needs multi-stone turns in the rules engine and its own bot search.
- **Related games:** Renju (15×15, first-player restrictions on double-threes, double-fours and overlines, plus an opening rule) and other five-in-a-row relatives fit the existing engine. **Go** is a different game (territory, ko, scoring) and needs its own rules, engine, coach and lessons: treat it as a separate large project.
## Testing in a browser
Serve with `python3 -m http.server` and drive with Playwright (headless Chrome is at /usr/bin/google-chrome in Claude's sandbox). Check both a 390×844 touch viewport and a desktop viewport, light and dark.
