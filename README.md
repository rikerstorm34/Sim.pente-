# Game Training Sim.pente

A training app for the game of Pente: practice bots at five levels, a live coach that points out threats and chances, and variants that each target a specific skill. It runs in the browser on phone and desktop, with light and dark themes.

**Play:** https://rikerstorm34.github.io/Sim.pente-/

## What's in it

- **Play a bot:** Pip (Novice), Juno (Apprentice), Ludo (Tactician), Vega (Strategist) and Orion (Master). The upper levels search for forced wins made of continuous five-threats, and stop yours.
- **Coach:** warns you about open pairs, win threats and open threes, flags capture chances, and checks a move you're previewing before you place it. Quiet by default: notes stay hidden until you tap to see them. Hints on request.
- **Lessons:** 7 units (rules, shapes, captures, initiative, openings, threat sequences, endgame). Each lesson explains an idea, then gives puzzles that get harder, some of them several moves long, and ends with a practice game against a bot.
- **Game review:** every game is saved. Open any one to replay it move by move. The analysis rates each move (Best to Blunder) and explains it in plain words. It also draws your winning chances through the game, picks out the key moments with a "Retry from here" button, and sums up what to work on.
- **Statistics:** win rate, streaks, results by opponent, variant and side, how you win and lose, and capture counts, built up from every game.
- **Patterns & openings:** your play style, the shapes you build and how the bots answer them, and your openings as Gold and Blue with win rates and the bots' replies.
- **Phone-friendly input:** tap to preview a move, then confirm. With a mouse, just click.
- **Eight variants,** each with plain-language rules and what it trains: Pente, Keryo-Pente, Gomoku, G-Pente, Boat-Pente, Poof-Pente, Double Five and Five + Captures.
- Undo, resign, move list, game saved automatically, recent results on the home screen.

Coming in later milestones: a puzzle trainer built from your own mistakes, more variants (Connect6, D-Pente, Swap2) and related games.

## Running it locally

It's a static site with no build step. Serve the folder with any web server, e.g.

```
python3 -m http.server 8000
```

then open http://localhost:8000. (Opening `index.html` directly from disk won't work, because browsers block JavaScript modules on `file://`.)

## Tests

```
npm test
```

Uses Node's built-in test runner (Node 18+); there are no dependencies to install.

## Project layout

| Path | What it is |
|---|---|
| `index.html` | Page shell: header, tab bar, theme bootstrapping |
| `css/styles.css` | All styles; light/dark themes are CSS variables |
| `js/rules.js` | Rules engine: moves, captures, fives, every variant's win rules, undo |
| `js/variants.js` | Variant configs plus their rules text and "what it trains" |
| `js/ai.js` | The bots: threat search (VCF), alpha-beta with a time budget, five levels |
| `js/stats.js` | Statistics computed from the saved game archive |
| `js/patterns.js` | Play style, shape and opening analytics |
| `js/lessons.js` | Lesson content (units, lessons, puzzles, practice games) |
| `js/lesson-engine.js` | Puzzle setup and goal checking |
| `js/review.js` | Game review: move ratings, explanations, key moments, focus areas |
| `js/ai-worker.js` | Runs the bot in a Web Worker so the page stays responsive |
| `js/coach.js` | The in-game coach's notes and move-preview warnings |
| `js/board.js` | SVG board rendering and tap/click handling |
| `js/app.js` | Screens (home, setup, variants, game), game flow, saving |
| `tests/` | Rules and bot tests |

Pente® is a trademark of Hasbro, Inc. This is an independent, non-commercial training tool and is not affiliated with or endorsed by Hasbro.
