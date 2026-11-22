// Hex lessons: six units from the rules to advanced reading. Original text; positions were built
// by hand or taken from bot games (tools/hex-puzzles.mjs), and every answer list is checked by
// tests/hex.test.js. Setups: { size, gold: [...], blue: [...], toMove, last? }.

const read = (title, text, board = null) => ({ type: 'read', title, text, board });
const puzzle = (title, level, setup, stages, theme = 'lesson') => ({ type: 'puzzle', title, level, setup, stages, theme });
const stage = (prompt, goal, answer, hint, success, extra = {}) => ({ prompt, goal, answer, hint, success, ...extra });
const play = (title, text, game) => ({ type: 'play', title, text, game });
const G = (kind, more = {}) => ({ kind, ...more });

export const UNITS = [
  {
    title: 'The board and the goal',
    blurb: 'How Hex works, why someone always wins, and the swap rule.',
    lessons: [
      {
        id: 'H1.1', title: 'Connect your edges', summary: 'Gold links top and bottom, Blue links left and right.',
        steps: [
          read('How Hex works', [
            'Hex is played on a rhombus of hexagons. Gold owns the top and bottom edges, Blue owns the left and right edges (marked in their colours). The corner cells belong to both.',
            'Players take turns placing one stone on any empty cell. Stones never move and are never captured. The first player to link their two edges with a chain of touching stones wins.',
            'Each cell touches six others. Cells are named by column (a, b, c…) and row (1, 2, 3… from the top), so a1 is the top-left corner.',
          ], { size: 7, gold: ['d1', 'd2', 'd3', 'c5', 'd4', 'c6', 'c7'], blue: ['a4', 'b4', 'c4', 'e3', 'f2'], toMove: 'gold', hints: [] }),
          puzzle('Finish the chain', 1, { size: 7, gold: ['d1', 'd2', 'd3', 'd4', 'd6', 'd7'], blue: ['c5', 'e4', 'b2', 'f6', 'a7'], toMove: 'gold' }, [
            stage('You are Gold. One stone connects top and bottom. Find it.', G('connect'), 'd5',
              'Look for the gap in your column.', 'Connected: top to bottom.', { accept: ['d5'] }),
          ]),
          puzzle('Block the connection', 1, { size: 7, gold: ['d1', 'c2', 'e6', 'b6'], blue: ['a4', 'b4', 'd4', 'e4', 'f4', 'g4'], toMove: 'gold' }, [
            stage('You are Gold. Blue connects left to right next move unless you stop it. Block.', G('block'), 'c4',
              'Blue\'s row has one gap.', 'Blocked. In Hex, stopping your opponent and building your own chain are two sides of the same thing.', { accept: ['c4'] }),
          ]),
        ],
      },
      {
        id: 'H1.2', title: 'No draws, and the swap rule', summary: 'The board can\'t fill up without a winner.',
        steps: [
          read('Someone always wins', [
            'Fill a Hex board completely and exactly one player will have a winning chain. A wall that stops Blue from crossing is itself a Gold chain from top to bottom, so blocking and connecting are the same thing.',
            'It has been proved that the first player can always win with perfect play. That is why serious games use the swap rule: after Gold\'s first stone, Blue may take it over (mirrored onto Blue\'s side) instead of playing. Gold then opens with a stone that is neither too strong nor too weak.',
            'For your first games, play on a small board without the swap rule and just try to connect.',
          ]),
          play('First game', 'Play Pip (Level 1) on a 7×7 board without the swap rule. Build toward both of your edges and block Pip when it gets close.', { level: 1, side: 'p1', options: { size: 7, swap: false } }),
        ],
      },
    ],
  },
  {
    title: 'Bridges and the centre',
    blurb: 'The most important shape in Hex, and why the centre is strong.',
    lessons: [
      {
        id: 'H2.1', title: 'The bridge', summary: 'Two stones with two empty cells between them are as good as connected.',
        steps: [
          read('The bridge', [
            'Two of your stones that share two empty neighbouring cells form a bridge. If your opponent plays in one of the two cells, you play in the other and the stones are connected.',
            'So a bridge is as good as a solid link, as long as you answer when your opponent pushes into it. This is the first reflex to learn: when they play into your bridge, reply in the other cell.',
            'A bridge also covers twice the distance of a solid step. Chains of bridges are how you move fast across the board.',
          ], { size: 7, gold: ['c3', 'd4'], blue: [], toMove: 'gold', hints: ['d3', 'c4'] }),
          puzzle('Save the bridge', 1, { size: 7, gold: ['c3', 'd4', 'd1', 'e6'], blue: ['d3', 'b5', 'f2'], toMove: 'gold', last: 'd3' }, [
            stage('You are Gold. Blue just played d3, inside your bridge between c3 and d4. Keep the stones connected.', G('saveBridge'), 'c4',
              'The bridge had two empty cells. One is gone.', 'Saved: c3 and d4 now touch through c4.', { accept: ['c4'] }),
          ]),
        ],
      },
      {
        id: 'H2.2', title: 'Chains of bridges', summary: 'Link stones with bridges and nothing can cut them.',
        steps: [
          read('The centre and the chain', [
            'A stone in the centre can reach both of your edges and get in the way of both of your opponent\'s. Early in the game, the centre is the strongest area; stones on the edge do little.',
            'If every link in your chain is either touching or a bridge, and no empty cell belongs to two links at once, your opponent can\'t cut it: every intrusion has an answer.',
            'The same works at the edge: a stone on the second row with both edge cells below it empty is connected to the edge (an edge bridge).',
          ]),
          puzzle('An unbreakable chain', 2, { size: 7, gold: ['c2', 'd3', 'e5', 'd6'], blue: ['b4', 'f3', 'c5', 'a6', 'g2'], toMove: 'gold' }, [
            stage('You are Gold. Add one stone so your chain from top to bottom can\'t be cut.', G('unbreakable'), 'd4',
              'Your chain has one gap that is not yet a bridge. Fill it so every link is a bridge or touching.', 'Every link is now solid or a bridge, including the edge bridges at both ends. The game is won.', { accept: ['d4', 'e4'] }),
          ]),
          play('Bridge game', 'Play Juno (Level 2) on 7×7 without the swap rule. Build with bridges, and answer every push into one.', { level: 2, side: 'p1', options: { size: 7, swap: false } }),
        ],
      },
    ],
  },
  {
    title: 'Reaching the edge',
    blurb: 'Edge bridges, edge templates and the ziggurat.',
    lessons: [
      {
        id: 'H3.1', title: 'The edge bridge', summary: 'A second-row stone is already connected to the edge.',
        steps: [
          read('Edge templates', [
            'A stone on the second row with two empty edge cells below it is connected to that edge: if your opponent takes one cell, you take the other. This is the simplest edge template.',
            'Edge templates are patterns of empty cells that guarantee a stone reaches its edge. Learning them saves moves: once a stone sits in a template, you can play elsewhere.',
          ], { size: 7, gold: ['d6'], blue: [], toMove: 'gold', hints: ['c7', 'd7'] }),
          puzzle('Answer at the edge', 1, { size: 7, gold: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'], blue: ['d7', 'e5', 'e3', 'f4', 'b4', 'c5'], toMove: 'gold', last: 'd7' }, [
            stage('You are Gold. Blue took one of the two edge cells below d6. Finish the connection.', G('connect'), 'c7',
              'The other edge cell under d6.', 'Connected. The edge bridge held.', { accept: ['c7'] }),
          ]),
          puzzle('Two ways down', 2, { size: 7, gold: ['d1', 'd2', 'd3', 'd5', 'd6'], blue: ['c4', 'e3', 'b5', 'f5', 'a2'], toMove: 'gold' }, [
            stage('You are Gold. Make a move after which you have two different ways to connect.', G('fork'), 'd4',
              'Close the gap in your column; then look at the bottom edge.', 'Two ways to finish, and Blue can only block one.', { accept: ['d4'] }),
          ]),
        ],
      },
      {
        id: 'H3.2', title: 'The ziggurat', summary: 'A third-row stone with the right space below is connected too.',
        steps: [
          read('Template IIIa: the ziggurat', [
            'A stone on the third row is also connected to the edge if a trapezoid of cells below it is empty: one cell beside it on its row, three on the row below, and four on the edge row. Named for its stepped shape, this is the ziggurat.',
            'Whatever your opponent plays inside it, you answer with a move that makes an edge bridge in the half they didn\'t touch.',
            'Templates can overlap with each other and with bridges. Two connections that need the same empty cell can both be broken by one stone there, so look for overlaps before you rely on them.',
          ], { size: 7, gold: ['d5'], blue: [], toMove: 'gold', hints: ['e5', 'c6', 'd6', 'e6', 'b7', 'c7', 'd7', 'e7'] }),
          play('Edge game', 'Play Juno (Level 2) on 9×9 without the swap rule. Look for edge bridges and ziggurats before you spend a move connecting to an edge.', { level: 2, side: 'p1', options: { size: 9, swap: false } }),
        ],
      },
    ],
  },
  {
    title: 'Blocking and ladders',
    blurb: 'Block from a distance, and handle ladders along the edge.',
    lessons: [
      {
        id: 'H4.1', title: 'Block from a distance', summary: 'A block right in front of a chain is easy to go around.',
        steps: [
          read('The classic block', [
            'The most common beginner mistake is blocking right next to the head of an opponent\'s chain. They step around it with a bridge and you are back where you started.',
            'Block further away instead, a bridge\'s distance or more in front of the chain, where your stone can answer both a straight advance and a sideways one. On small boards there is less room, so adjust.',
            'Remember that a block is also a stone in your own chain: the best blocks build toward your edges too.',
          ]),
          puzzle('Stop it now', 1, { size: 7, gold: ['d1', 'c2', 'e6', 'b6'], blue: ['a4', 'b4', 'd4', 'e4', 'f4', 'g4'], toMove: 'gold' }, [
            stage('You are Gold. Blue is one stone from connecting. Block it.', G('block'), 'c4',
              'Find the one cell that completes Blue\'s row.', 'Blocked. Next time, block earlier and further away.', { accept: ['c4'] }),
          ]),
        ],
      },
      {
        id: 'H4.2', title: 'Ladders', summary: 'Pushing along the edge, and escaping.',
        steps: [
          read('Ladders', [
            'When an attacker pushes along the second row toward an edge, the defender has to keep answering on the first row, and the chain crawls sideways. This is a ladder.',
            'A ladder on the second row usually goes nowhere for the attacker, unless a stone of theirs waits further along the edge: a ladder escape. Then the ladder reaches it and connects.',
            'So before you start a ladder, look for an escape; and when you defend one, take away the escape early if you can. Ladders on the third row are rarer and harder to judge.',
          ]),
          play('Blocking game', 'Play Ludo (Level 3) on 9×9 without the swap rule. Block from a distance, and look for ladder escapes along the edges.', { level: 3, side: 'p1', options: { size: 9, swap: false } }),
        ],
      },
    ],
  },
  {
    title: 'Openings and the swap rule',
    blurb: 'Which first stones are strong, and when to swap.',
    lessons: [
      {
        id: 'H5.1', title: 'The swap rule in practice', summary: 'Open with a fair stone; swap the strong ones.',
        steps: [
          read('Fair openings', [
            'With the swap rule, Gold wants a first stone that is about even: if it is too strong Blue swaps it, if it is too weak Blue lets it be and Gold is behind.',
            'On small boards every opening has been solved by computer. Central stones win for the player who has them, so Blue should swap them. Stones in the acute corners (a1 and its mirror) lose.',
            'Good practical rule: as Blue, swap anything near the centre and most stones not on the first row of Gold\'s own edges. As Gold, open near an edge, for example on the second row toward a corner, where the outcome is close.',
          ]),
          play('Swap practice', 'Play Juno (Level 2) on 9×9 with the swap rule. As Blue, decide whether to swap; as Gold, pick a fair first stone.', { level: 2, side: 'random', options: { size: 9, swap: true } }),
        ],
      },
      {
        id: 'H5.2', title: 'The full board', summary: 'Move up to 11×11.',
        steps: [
          read('Bigger boards', [
            'On 11×11 there is room for everything you have learned: chains of bridges, edge templates, distant blocks and ladders. Opening theory says many second- and third-row stones near the edges are close to even.',
            'Plan in terms of connections, not single stones: which of your groups are already safely linked to an edge, and where is the weak point your opponent will attack?',
          ]),
          play('11×11', 'Play Ludo (Level 3) on 11×11 with the swap rule.', { level: 3, side: 'random', options: { size: 11, swap: true } }),
        ],
      },
    ],
  },
  {
    title: 'Advanced reading',
    blurb: 'Must-play areas, dead cells, double threats.',
    lessons: [
      {
        id: 'H6.1', title: 'Must-play and double threats', summary: 'When your opponent has two ways to win, you must stop both.',
        steps: [
          read('Reading ahead', [
            'If your opponent has several ways to connect, your move has to break all of them at once, so it must go where they overlap: the must-play area. Everywhere else loses at once.',
            'Turn this around when you attack: make two threats that don\'t overlap, and one stone can\'t answer both. That is the double threat, the finishing move of most Hex games.',
            'Some cells can never matter to either player (dead cells), and some are as good as yours already (captured cells). Strong players don\'t waste moves on either.',
          ]),
          puzzle('Double threat', 2, { size: 7, gold: ['d1', 'd2', 'd3', 'd5', 'd6'], blue: ['c4', 'e3', 'b5', 'f5', 'a2'], toMove: 'gold' }, [
            stage('You are Gold. Create two separate ways to connect.', G('fork'), 'd4',
              'One stone that links your column and leaves two finishing cells.', 'Two threats that don\'t overlap: unstoppable.', { accept: ['d4'] }),
          ]),
          play('Strong opponent', 'Play Vega (Level 4) on 9×9 with the swap rule.', { level: 4, side: 'random', options: { size: 9, swap: true } }),
        ],
      },
      {
        id: 'H6.2', title: 'Final test', summary: 'Beat Orion.',
        steps: [
          read('Putting it together', [
            'Orion searches longest. To beat it you need sound bridges, safe edge connections, distant blocks, and a double threat at the right moment.',
            'Review your games afterwards: the analysis shows where your winning chances dropped and which bridges you left cut.',
          ]),
          play('Beat Orion', 'Play Orion (Level 5) on 9×9 with the swap rule.', { level: 5, side: 'random', options: { size: 9, swap: true } }),
        ],
      },
    ],
  },
];
