# Game Training Sim.pente

A training app for the game of Pente: practice bots at five levels, a live coach that points out threats and chances, and variants that each target a specific skill. It runs in the browser on phone and desktop, with light and dark themes.

**Play:** https://rikerstorm34.github.io/Sim.pente-/

## What's in it

- **Play a bot:** Pip (Novice), Juno (Apprentice), Ludo (Tactician), Vega (Strategist) and Orion (Master). The upper levels search for forced wins made of continuous five-threats, and stop yours.
- **Coach:** warns you about open pairs, win threats and open threes, flags capture chances, and checks a move you're previewing before you place it. Quiet by default: notes stay hidden until you tap to see them. Hints on request.
- **Lessons:** 11 units, 39 lessons (rules, shapes, captures, initiative, openings, threat sequences, endgame, a lesson for every variant, and master ideas such as keystones and quiet moves). Each lesson explains an idea, then gives puzzles that get harder, some of them several moves long, and ends with a practice game against a bot; winning it completes the lesson. Advanced lessons put you on a random side so you practise both colours. Puzzles are set on busy, game-like boards so you learn to spot patterns in real positions.
- **Puzzles:** a trainer with about 700 puzzles (positions from the 1983 World Championship every lesson puzzle, and wins you missed in your own games), sorted by theme and level, with missed puzzles coming back until you solve them. Each time a puzzle comes back it can look different (rotated, mirrored or with colours swapped) while testing the same idea.
- **1983 World Championship:** 109 games from the 1983 World Pente Championship to replay with the engine's analysis, follow either player, and play on from any position, plus statistics on what separated winners from losers (habits, shapes, board heatmaps, openings, players), an opening explorer, and lesson units on the masters' positions and openings. Game records (moves and results only) are from the U.S. Pente Association booklet *Championship Pente*.
- **Game review:** every game is saved (the newest 5000 can be opened; older ones still count in your stats). Open any one to replay it move by move. The analysis rates each move (Best to Blunder) and explains it in plain words. It also draws your winning chances through the game, picks out the key moments with a "Retry from here" button, and sums up what to work on. Retries are kept as variations of the original game, not as new games.
- **Statistics:** win rate, streaks, results by opponent, variant and side, how you win and lose, and capture counts, built up from every game.
- **Patterns & openings:** your play style, the shapes you build and how the bots answer them, and your openings as Gold and Blue with win rates and the bots' replies.
- **Phone-friendly input:** tap to preview a move, then confirm. With a mouse, just click.
- **Twelve variants,** each with plain-language rules and what it trains: Pente, Keryo-Pente, Gomoku, G-Pente, Boat-Pente, Poof-Pente, Double Five, Five + Captures, D-Pente, DK-Pente and Swap2 (one player sets up the opening, the other picks a side), and Connect6 (two stones a turn, six in a row).
- Undo, resign, move list, game saved automatically, recent results on the home screen.

Coming in later milestones: Renju and Ninuki-Renju, and other related games.

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
| `js/openings.js` | Choose-your-side openings (D-Pente, DK-Pente, Swap2): turn order, choices, bot set-ups |
| `js/connect6.js` | Connect6 bot, coach helpers and review analysis |
| `js/history.js` | The saved game archive (compact storage, 5000 openable games, variations) |
| `js/stats.js` | Statistics computed from the saved game archive |
| `js/patterns.js` | Play style, shape and opening analytics |
| `js/lessons.js`, `js/lessons-more.js` | Lesson content (units, lessons, puzzles, practice games) |
| `js/lesson-boards.js` | Generated extra stones for busy puzzle boards (`node tools/dress-puzzles.mjs`) |
| `js/lesson-engine.js` | Puzzle setup and goal checking |
| `js/review.js` | Game review: move ratings, explanations, key moments, focus areas |
| `js/ai-worker.js` | Runs the bot in a Web Worker so the page stays responsive |
| `js/coach.js` | The in-game coach's notes and move-preview warnings |
| `js/board.js` | SVG board rendering and tap/click handling |
| `js/app.js` | Screens (home, setup, variants, game), game flow, saving |
| `tests/` | Rules and bot tests |

Pente® is a trademark of Hasbro, Inc. This is an independent, non-commercial training tool and is not affiliated with or endorsed by Hasbro.
