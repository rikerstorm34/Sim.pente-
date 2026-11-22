// Reversi lessons: six units from the rules to perfect endgames. Original text; positions come
// from bot games (see tools/reversi-puzzles.mjs) or were built by hand, and every answer is
// checked by tests/reversi.test.js.
//
// Step builders: read(title, paragraphs, board?), puzzle(title, level, setup, stages, theme),
// play(title, text, game). Setups: { moves: 'f5d6' } or { gold: [...], blue: [...], toMove }.

const read = (title, text, board = null) => ({ type: 'read', title, text, board });
const puzzle = (title, level, setup, stages, theme = 'lesson') => ({ type: 'puzzle', title, level, setup, stages, theme });
const stage = (prompt, goal, answer, hint, success, extra = {}) => ({ prompt, goal, answer, hint, success, ...extra });
const play = (title, text, game) => ({ type: 'play', title, text, game });
const G = (kind, more = {}) => ({ kind, ...more });

export const UNITS = [
  {
    title: 'Rules and notation',
    blurb: 'How a move works, passing, the end of the game and how squares are named.',
    lessons: [
      {
        id: 'R1.1', title: 'How a move works', summary: 'Outflank a line of discs and it flips.',
        steps: [
          read('Outflanking', [
            'Every move puts one disc on an empty square. It must trap at least one straight line of your opponent\'s discs between the new disc and another disc of yours: across, down or diagonally. Every trapped line flips to your colour.',
            'Only lines that end at the new disc count. Discs that just flipped do not flip anything else in turn, and a gap or the edge of the board breaks a line.',
            'Squares are named by column (a–h, left to right) and row (1–8, top to bottom), so a1 is the top-left corner. At the start Gold has four possible moves, marked here.',
          ], { moves: '', hints: ['d3', 'c4', 'f5', 'e6'] }),
          puzzle('Your first move', 1, { moves: '' }, [
            stage('You are Gold. Find a square where your disc traps a Blue disc.', G('points', { points: ['d3', 'c4', 'f5', 'e6'] }), 'f5',
              'Look for a Blue disc with your own disc on the far side and an empty square on the near side.', 'Right. All four first moves are the same up to symmetry; most players start with f5.', { accept: ['d3', 'c4', 'f5', 'e6'] }),
          ]),
          puzzle('Two lines at once', 1, { gold: ['d5', 'f5'], blue: ['d4', 'e4'], toMove: 'gold' }, [
            stage('Find the move that flips discs in two directions at once.', G('mostFlips'), 'd3',
              'One square sits above a Blue disc and also diagonally in line with another.', 'Two lines trapped, two discs flipped: one straight down and one diagonally.', { accept: ['d3'] }),
          ]),
        ],
      },
      {
        id: 'R1.2', title: 'Passing and the end', summary: 'No move means a pass; the game ends when nobody can move.',
        steps: [
          read('Passing, the end and the score', [
            'If you have no legal move, you pass and your opponent moves again. If you do have a move, you must play.',
            'The game ends when neither player can move, usually when the board is full. The player with more discs wins. Empty squares left at the end are added to the winner\'s total, and a tie is scored 32–32.',
            'A pass is a big deal. Forcing your opponent to pass gives you two moves in a row, and good players steer the endgame so that it happens.',
          ]),
          puzzle('Make them pass', 2, { gold: ['d3', 'd4', 'e4', 'd5', 'e5', 'f5', 'h5', 'f6', 'f7'], blue: ['h4', 'g5'], toMove: 'blue' }, [
            stage('You are Blue. One of your moves leaves Gold with no legal move at all. Find it.', G('makePass'), 'h6',
              'After your move, check every empty square next to a Blue disc: can Gold trap anything?', 'Gold has to pass, and you move again.', { accept: ['h6'] }),
          ]),
          play('First game', 'Play Pip (Level 1). Pip often grabs as many discs as it can, which is exactly what the next unit teaches you to punish.', { level: 1, side: 'p1' }),
        ],
      },
    ],
  },
  {
    title: 'Why greed loses',
    blurb: 'Corners, stable discs, the squares next to corners, and why fewer discs early is fine.',
    lessons: [
      {
        id: 'R2.1', title: 'Corners and stable discs', summary: 'A corner can never be flipped.',
        steps: [
          read('Discs that stay yours', [
            'Most discs change colour many times. A corner can never be flipped, because no line runs through it from both sides. From a corner, discs along the edges can become impossible to flip as well: these are stable discs.',
            'Stable discs are what you keep at the end. That is why strong players care far more about corners and stability than about how many discs are on the board in the middle of the game.',
          ], { gold: ['a1', 'b1', 'c1', 'a2', 'b2', 'a3'], blue: ['d4', 'e5', 'd5', 'e4'], toMove: 'gold', hints: ['a1'] }),
          puzzle('Take the corner', 1, { gold: ['c6', 'e6', 'f6', 'd7', 'e7', 'f7', 'c8', 'd8', 'e8', 'f8', 'g8'], blue: ['f3', 'd4', 'e4', 'f4', 'g4', 'd5', 'e5', 'f5', 'g5', 'd6', 'h6', 'c7', 'b8'], toMove: 'gold' }, [
            stage('You are Gold. A corner is open to you, and here it is also the best move. Take it.', G('corner'), 'a8',
              'Look along the bottom edge and the diagonal.', 'The corner is yours for good, and the bottom edge with it.', { accept: ['a8'] }),
          ]),
        ],
      },
      {
        id: 'R2.2', title: 'X-squares and C-squares', summary: 'The squares next to an empty corner are dangerous.',
        steps: [
          read('Squares that give corners away', [
            'The square diagonally next to a corner (b2, g2, b7, g7) is called an X-square. The squares beside a corner on the edges (a2, b1 and so on) are C-squares.',
            'While the corner is empty, a disc of yours on an X-square often gives your opponent a line into the corner. C-squares are less dangerous but still risky, especially when they stand alone on the edge.',
            'Before you play next to an empty corner, ask: after this move, can my opponent reach the corner? If yes, look for something else.',
          ], { gold: ['d4', 'e5'], blue: ['d5', 'e4'], toMove: 'gold', threats: ['b2', 'g2', 'b7', 'g7'] }),
          puzzle('A safe move', 2, { gold: ['e3', 'f3', 'c4', 'e4', 'f4', 'b5', 'c5', 'e5', 'f5', 'c6', 'f6', 'c7', 'e7', 'f7', 'g7'], blue: ['d3', 'd4', 'd5', 'd6', 'e6', 'd7', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8'], toMove: 'gold' }, [
            stage('You are Gold. Most of your moves give Blue a corner. Find one that doesn\'t.', G('noCorner'), 'c3',
              'Moves near the bottom edge open lines to the corners there.', 'Safe: Blue gets no corner from that.', { accept: ['c3'] }),
          ]),
        ],
      },
      {
        id: 'R2.3', title: 'Less is more', summary: 'Flipping many discs early usually backfires.',
        steps: [
          read('The disc-count trap', [
            'In the middle of the game, the number of discs you have tells you almost nothing. What matters is how many good moves each side has left.',
            'A move that flips lots of discs turns many outside discs your colour. Those are new targets for your opponent, so you hand them more moves and take moves away from yourself.',
            'Good players often have fewer discs for most of the game, then win the corners and edges and finish ahead.',
          ]),
          puzzle('Starve your opponent', 2, { gold: ['b4', 'c4', 'b5', 'c5', 'b6', 'c6', 'd6'], blue: ['d4', 'e4', 'f4', 'd5', 'e5', 'f5', 'e6', 'd7'], toMove: 'blue' }, [
            stage('You are Blue. Find the move that leaves Gold the fewest replies.', G('fewest'), 'a6',
              'Count Gold\'s moves after each of yours. A move on the edge that flips few discs can be best.', 'Gold is left with very few moves, and most of them are bad.', { accept: ['a6'] }),
          ]),
          play('Corners first', 'Play Juno (Level 2). Avoid squares next to empty corners, and don\'t chase discs.', { level: 2, side: 'p1' }),
        ],
      },
    ],
  },
  {
    title: 'Mobility and frontier',
    blurb: 'Keep your options open and your opponent\'s closed.',
    lessons: [
      {
        id: 'R3.1', title: 'Mobility', summary: 'Win by leaving your opponent only bad moves.',
        steps: [
          read('Moves are the real currency', [
            'Mobility is how many legal moves you have. The idea behind almost every strong move is to keep your mobility high and your opponent\'s low.',
            'The goal is not just to give your opponent few moves, but to leave them only bad ones: X-squares, C-squares, and moves that open an edge for you. When they run out of safe moves, they have to give you something.',
            'Potential mobility counts the empty squares next to your opponent\'s discs: moves they may get soon. Keeping your own discs off the outside keeps your opponent\'s potential mobility low.',
          ]),
          puzzle('Fewest replies', 3, { gold: ['d1', 'b3', 'd3', 'c4', 'd4', 'e4', 'd5', 'e5', 'f5', 'e6'], blue: ['c1', 'd2', 'e3', 'f4', 'd6'], toMove: 'blue' }, [
            stage('You are Blue. Find the move that leaves Gold the fewest moves.', G('fewest'), 'e7',
              'A move that flips just one inner disc can shut many doors.', 'Gold\'s choices shrink, and the good ones are gone.', { accept: ['e7'] }),
          ]),
          puzzle('Fewest replies again', 3, { gold: ['c5', 'd5', 'd6', 'e6', 'f7'], blue: ['d4', 'e4', 'f4', 'e5', 'f5', 'f6', 'd7', 'e7', 'c8', 'f8'], toMove: 'blue' }, [
            stage('You are Blue. Again: leave Gold as few moves as you can.', G('fewest'), 'c6',
              'Look next to Gold\'s small group.', 'Gold is nearly out of moves.', { accept: ['c6'] }),
          ]),
        ],
      },
      {
        id: 'R3.2', title: 'Frontier and quiet moves', summary: 'Flip inside discs, not outside ones.',
        steps: [
          read('The frontier', [
            'A frontier disc is one next to an empty square. Frontier discs are what your opponent plays against: the more you have, the more moves you give them.',
            'A quiet move flips only discs that are already surrounded, adding little or nothing to your frontier. A loud move flips discs on the outside and builds a wall that your opponent can play along.',
            'Early in the game, play into the middle, keep your discs together, and prefer the quiet move when two moves look alike.',
          ]),
          puzzle('The quiet move', 3, { gold: ['e2', 'e3', 'c4', 'd4', 'e4', 'c5', 'd5', 'e5', 'c6'], blue: ['f3', 'g3', 'f5', 'e6', 'f6', 'g6'], toMove: 'blue' }, [
            stage('You are Blue. Find the move that adds the fewest discs to your frontier.', G('leastFrontier'), 'd1',
              'Look for a move whose flipped discs end up surrounded.', 'Quiet: hardly any new outside discs for Gold to aim at.', { accept: ['d1'] }),
          ]),
          puzzle('Quiet again', 3, { gold: ['c3', 'd3', 'b4', 'c4', 'd4', 'e4', 'd5', 'e5', 'f5', 'e6'], blue: ['e3', 'f4', 'c5', 'c6', 'd6'], toMove: 'blue' }, [
            stage('You are Blue. Find the quietest move.', G('leastFrontier'), 'f3',
              'Which move flips discs that are already inside the mass?', 'Your frontier barely grows.', { accept: ['f3'] }),
          ]),
          play('Mobility game', 'Play Ludo (Level 3). Prefer quiet moves and count Ludo\'s replies before you move.', { level: 3, side: 'p1' }),
        ],
      },
    ],
  },
  {
    title: 'Openings',
    blurb: 'The first moves, and the named lines strong players use.',
    lessons: [
      {
        id: 'R4.1', title: 'The first moves', summary: 'f5, then perpendicular, diagonal or parallel.',
        steps: [
          read('Three families', [
            'Gold\'s four first moves are mirror images of each other, so by convention everyone plays f5 and records games that way.',
            'Blue then has three kinds of reply: perpendicular (d6), diagonal (f6) and parallel (f4). The perpendicular and the diagonal are both sound. The parallel is considered weaker and is rarely played by strong players.',
            'Opening principles: stay in the central 4×4 area, keep your discs together, avoid flipping discs on the outside, and don\'t rush to the edges.',
          ], { moves: 'f5', hints: ['d6', 'f6'] }),
          puzzle('A sound reply', 1, { moves: 'f5' }, [
            stage('You are Blue. Gold opened f5. Play one of the two sound replies.', G('points', { points: ['d6', 'f6'] }), 'd6',
              'The parallel reply (f4) is the one to avoid.', 'A sound start. d6 is the perpendicular opening and f6 the diagonal.', { accept: ['d6', 'f6'] }),
          ]),
        ],
      },
      {
        id: 'R4.2', title: 'Tiger and Rose', summary: 'Two of the most played lines after the perpendicular.',
        steps: [
          read('Named lines', [
            'After f5 d6, the Tiger continues c3 d3 c4. It is one of the most popular openings at championship level.',
            'The Rose goes f5 d6 c5 f4 e3 c6 d3 f6 e6 d7, a long line built on quiet moves. Against the diagonal (f5 f6), e6 f4 then c3 is the Buffalo and e6 f4 g5 the Heath.',
            'You don\'t need to memorise long lines yet. Knowing a few first moves keeps you out of early trouble, and your game records show which named line each game started with.',
          ], { moves: 'f5d6c3d3c4', hints: [] }),
          puzzle('The Tiger', 2, { moves: 'f5d6c3d3' }, [
            stage('You are Gold. Continue the Tiger: f5 d6 c3 d3, and now?', G('points', { points: ['c4'] }), 'c4',
              'The Tiger\'s fifth move sits right next to your c3 disc.', 'f5 d6 c3 d3 c4: the Tiger.', { accept: ['c4'] }),
          ]),
          puzzle('The Rose', 3, { moves: 'f5d6c5f4e3c6d3f6e6' }, [
            stage('You are Blue. The Rose: f5 d6 c5 f4 e3 c6 d3 f6 e6, and Blue plays?', G('points', { points: ['d7'] }), 'd7',
              'It is a quiet move just below your d6 disc.', 'The Rose main line, ending with d7.', { accept: ['d7'] }),
          ]),
          play('Opening practice', 'Play Ludo (Level 3). Try the Tiger as Gold or the perpendicular reply as Blue, and look up the opening name in your game record afterwards.', { level: 3, side: 'random' }),
        ],
      },
    ],
  },
  {
    title: 'Edges and tempo',
    blurb: 'Wedges, balanced and unbalanced edges, sacrifices and waiting moves.',
    lessons: [
      {
        id: 'R5.1', title: 'Wedges and edges', summary: 'A disc between two enemy edge discs can\'t be flipped back.',
        steps: [
          read('Edges', [
            'Edge discs can only be flipped along the edge itself. That makes edges powerful once you control them, and risky to take early.',
            'A wedge is a disc placed in a gap between two of your opponent\'s edge discs. Your opponent cannot flip it back along the edge, and it often wins you the corner later.',
            'Rule of thumb: an odd number of empty squares between two of your edge discs lets your opponent wedge in; an even number does not.',
            'A balanced edge (discs placed evenly, for example c1 to f1) is generally safe. An unbalanced edge, bunched toward one corner, invites a sacrifice on the X-square that wins the corner and a wedge.',
          ], { gold: ['e2', 'e3', 'd4', 'e5'], blue: ['c1', 'd1', 'f1', 'g1', 'd5', 'e4'], toMove: 'gold', hints: ['e1'] }),
          puzzle('Wedge in', 2, { gold: ['e3', 'c4', 'd4', 'd5', 'e5', 'f5'], blue: ['c1', 'd1', 'f1', 'g1', 'e2', 'e4'], toMove: 'gold' }, [
            stage('You are Gold. Blue\'s top edge has a one-square gap. Play the wedge.', G('points', { points: ['e1'] }), 'e1',
              'The gap is between d1 and f1.', 'A wedge: Blue can\'t flip it back along the edge.', { accept: ['e1'] }),
          ]),
        ],
      },
      {
        id: 'R5.2', title: 'Tempo and sacrifices', summary: 'Sometimes the strongest move is a waiting move, or giving a corner.',
        steps: [
          read('Tempo', [
            'Often it is bad to have to move: every move changes something, and late in the game most changes help your opponent. Gaining a tempo means making a move that leaves your opponent to break into a new area first.',
            'In an edge fight the order of moves matters: one move may gain the tempo while a similar-looking one gives it away.',
            'Strong players also sacrifice: giving up an X-square or even a corner can be right if it wins more stable discs or tempo elsewhere. Count the stable discs each side gains before you decide.',
            'The Stoner trap is the classic example: a player takes an X-square on purpose to control a diagonal, then attacks a weak edge and wins a corner by force.',
          ]),
          puzzle('Corner safety', 3, { gold: ['d1', 'd2', 'c3', 'd3', 'e3', 'f3', 'b4', 'c4', 'd4', 'e4', 'b5', 'c5', 'd5', 'f5', 'b6', 'c6', 'e6', 'f6', 'g6', 'f7', 'g8'], blue: ['e5', 'd6', 'c7', 'd7', 'e7', 'b8', 'c8', 'd8', 'e8', 'f8'], toMove: 'blue' }, [
            stage('You are Blue. Most of your moves give Gold a corner. Find one that doesn\'t.', G('noCorner'), 'h8',
              'Sometimes the safe move is a corner of your own.', 'Safe, and a corner too.', { accept: ['h8'] }),
          ]),
          play('Edge play', 'Play Vega (Level 4). Leave the edges alone until taking one gains something, and check every X- and C-square move twice.', { level: 4, side: 'random' }),
        ],
      },
    ],
  },
  {
    title: 'Endgame and perfect play',
    blurb: 'Parity, counting, and finishing like a computer.',
    lessons: [
      {
        id: 'R6.1', title: 'Parity', summary: 'Get the last move in each region.',
        steps: [
          read('The last move', [
            'With no passes, Blue always moves with an odd number of empty squares and Gold with an even number, so Blue gets the last move of the game. That last move is worth a lot: nothing can be flipped back afterwards.',
            'In the endgame the empty squares split into regions. The aim is to get the last move in each region. A good rule: move into regions with an odd number of empty squares, and leave the even ones.',
            'Passes change everything: a region your opponent cannot enter is effectively yours, and forcing a pass swaps who gets the last move.',
          ]),
          puzzle('Odd region', 4, { gold: ['b1', 'c1', 'd1', 'e1', 'f1', 'a2', 'c2', 'f2', 'a3', 'b3', 'd3', 'f3', 'a4', 'b4', 'c4', 'd4', 'e4', 'g4', 'a5', 'b5', 'c5', 'd5', 'f5', 'g5', 'a6', 'b6', 'c6', 'e6', 'f6', 'g6', 'd7', 'e7', 'f7'], blue: ['d2', 'e2', 'h2', 'c3', 'e3', 'g3', 'h3', 'f4', 'h4', 'e5', 'h5', 'd6', 'h6', 'c7', 'b8', 'c8', 'd8', 'e8', 'f8'], toMove: 'gold' }, [
            stage('You are Gold. This endgame is solved: only one move wins by 8. Find it.', G('best'), 'b7',
              'Count the empty squares in each region.', 'Exactly right: perfect play from here wins by 8.', { accept: ['b7'] }),
          ]),
        ],
      },
      {
        id: 'R6.2', title: 'Counting the endgame', summary: 'With few squares left, every line can be counted.',
        steps: [
          read('Counting', [
            'With about a dozen empty squares left, strong players stop judging and start counting: for each candidate move, how many discs does it win or lose by with best play?',
            'Look for moves that force a pass, moves that take a region your opponent can\'t enter, and corners that turn many edge discs stable at once.',
            'Computers play these positions perfectly, so endgame puzzles have exact answers. Here, only one move gets the best result.',
          ]),
          puzzle('Count it out', 4, { gold: ['f1', 'c2', 'f2', 'a3', 'b3', 'c3', 'd3', 'h3', 'a4', 'b4', 'c4', 'e4', 'g4', 'h4', 'a5', 'd5', 'f5', 'g5', 'h5', 'a6', 'c6', 'e6', 'f6', 'g6', 'h6', 'f7', 'h7', 'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8'], blue: ['b2', 'g2', 'h2', 'e3', 'f3', 'g3', 'd4', 'f4', 'b5', 'c5', 'e5', 'b6', 'd6', 'a7', 'b7', 'c7', 'd7', 'e7'], toMove: 'gold' }, [
            stage('You are Gold. Only one move wins (by 4). Find it.', G('best'), 'h1',
              'One corner is open.', 'Correct: perfect play from here wins by 4.', { accept: ['h1'] }),
          ]),
          puzzle('A big finish', 5, { gold: ['a2', 'a3', 'b3', 'd3', 'e3', 'h3', 'a4', 'c4', 'h4', 'a5', 'c5', 'd5', 'h5', 'a6', 'h6'], blue: ['c1', 'd1', 'e1', 'f1', 'g1', 'b2', 'c2', 'd2', 'e2', 'f2', 'c3', 'f3', 'g3', 'b4', 'd4', 'e4', 'f4', 'g4', 'b5', 'e5', 'f5', 'g5', 'b6', 'c6', 'd6', 'e6', 'f6', 'g6', 'c7', 'd7', 'e7', 'f7', 'g7', 'c8', 'd8', 'e8', 'f8'], toMove: 'gold' }, [
            stage('You are Gold, and far behind on discs. Yet one move wins by 36. Find it.', G('best'), 'a7',
              'Edges and corners on the left are where the discs turn stable.', 'Correct: perfect play from here wins by 36. Disc count in the middle means little.', { accept: ['a7'] }),
          ]),
          play('Endgame test', 'Play Vega (Level 4). Vega plays the last 12 squares perfectly, so count carefully once the board fills up.', { level: 4, side: 'random' }),
        ],
      },
      {
        id: 'R6.3', title: 'Final test', summary: 'Beat Orion.',
        steps: [
          read('Putting it together', [
            'Orion searches deep and plays the last 16 squares perfectly. To beat it you need everything: quiet moves early, no gifts next to empty corners, careful edge play, and accurate counting at the end.',
            'Review every game afterwards. The analysis shows where the balance turned, and the moves you get wrong become your next puzzles to practise.',
          ]),
          play('Beat Orion', 'Play Orion (Level 5). Take your time on every move.', { level: 5, side: 'random' }),
        ],
      },
    ],
  },
];
