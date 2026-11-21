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
3. ✅ Game review + archive (2026-11-21): `#/review` lists every saved game (filters); `#/review/<id>` replays it with an analysis run once in the Web Worker (`analysePosition` in ai.js: iterative deepening ~400 ms/position, VCF both ways, opponent's best reply) and cached in `gts.analysis` (newest 60). `js/review.js` rates moves (Best/Excellent/Good/Inaccuracy/Mistake/Missed win/Blunder by lost winning chance), explains them, builds the smoothed winning-chances curve, key moments ("Retry from here" starts a game from that position) and focus tags. Home's Focus areas card sums focus tags over the last 10 reviewed games.
   - ✅ Patterns & openings (`#/stats?tab=patterns`, `js/patterns.js`): play-style profile (forcing/defensive %, captures, exposed pairs, double threats), shapes you build (pair, split three, tria, four, open four) with win rate, kept-initiative rate and how the bots answered (blocked/captured/counter-attacked/elsewhere), openings as Gold (your 2nd stone) and as Blue (your reply), normalised under the 8 board symmetries, with the bots' replies and win rates. Computed live from the archive (~0.1 s for 300 games).
4. ✅ Lessons (2026-11-21): `#/learn` and `#/learn/<id>?s=<step>`. Content in `js/lessons.js` + `js/lessons-more.js` (9 units, 30 lessons, read → graded puzzles → practice game). Puzzles have one or more stages; each stage has a goal checked by `js/lesson-engine.js` (win, capture, block, blockTria, tria, split3, openFour, four, safe, noCaptures, capThreat, forcedWin, stopForced, points, legal, or `all`), an answer, hint, success text and a scripted reply for the opponent between stages. `tests/lessons.test.js` verifies every answer and reply — when adding puzzles, run `npm test`; to see all solutions of a stage use `solutions()` from lesson-engine. Progress/stars in `gts.lessons`; practice games carry `lesson` meta and mark the step done on a win.
   - Riker's direction: scenarios get gradually harder and build on earlier lessons (e.g. "find the capture that saves you" then "set up an automatic win").
   - ✅ Busy boards (2026-11-21): Riker wants puzzles on cluttered, game-like boards so he learns to spot patterns. `tools/dress-puzzles.mjs` adds 16–38 extra stones per puzzle (blocked lines, bracketed pairs, crossing pairs) and writes `js/lesson-boards.js`. A group of stones is kept only if it changes no five/four/open-four point or capture chance for either side at any stage, and the real goal checker still passes with the same set of solutions. **After adding or changing any puzzle, run `node tools/dress-puzzles.mjs`, then `npm test`** (a test fails if a puzzle has no busy board). Read-step diagrams stay clean.
   - ✅ Unit 8 "Variant skills" (one lesson per variant, with puzzles and a practice game) and Unit 9 "Master ideas" (keystones, a bigger threat, double attacks on pairs, the quiet move) are in `js/lessons-more.js`; step builders in `js/lesson-dsl.js`. Extra goals: quiet, doubleCapThreat, bank; setups can start with `banked` fives and a Boat `pendingFive`. The app accepts a stage's tested answer without re-running the slow forced-win search.
   - 2026-11-21: Board Game Arena "Tips_pente" (screenshots from Riker) added lesson 5.3 Opening shapes (the hat), 9.2 Which end to block (block into the capture), and the 9.1 puzzle "Keystones and a three". The threat search (`findVCF` in ai.js) now also tries **keystone captures**: captures that reopen a blocked four (test in ai.test.js). Ludo new vs old: 13–17 over 30 games, i.e. no measurable strength change; the gain is correct analysis of keystone wins.
   - Research notes for advanced play (sources outside Braunlich's books) are in the claude.ai Project doc `claude/research-advanced-play.md`.
5. Puzzles from the player's own mistakes, spaced repetition
6. Remaining variant openings (D-Pente, DK, Swap2); multiplayer is deferred

## Requests from Riker (2026-11-21), not yet built
- ✅ **Quiet coach** (built 2026-11-21): modes Quiet (default; notes and board markers hidden behind a "Coach has N notes" button, re-hidden each turn), Always show, Off.
- **Connect6:** first player places 1 stone, then players alternate placing 2 stones per turn; six or more in a row wins; no captures. Needs multi-stone turns in the rules engine and its own bot search.
- **Related games:** Renju (15×15, first-player restrictions on double-threes, double-fours and overlines, plus an opening rule) and other five-in-a-row relatives fit the existing engine. **Go** is a different game (territory, ko, scoring) and needs its own rules, engine, coach and lessons: treat it as a separate large project.
## Testing in a browser
Serve with `python3 -m http.server` and drive with Playwright (headless Chrome is at /usr/bin/google-chrome in Claude's sandbox). Check both a 390×844 touch viewport and a desktop viewport, light and dark.
