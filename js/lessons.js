// Lesson content: units that build on each other, from the rules to master-level ideas.
// Units 1–7 are here; unit 8 (variants) and unit 9 (master ideas) are in lessons-more.js.
// Every puzzle is checked by tests/lessons.test.js: each stage's answer must meet its goal,
// and each scripted reply must be legal. Text is original writing.
//
// Step types
//   read   – explanation, optional board diagram
//   puzzle – one or more stages; each stage: prompt, goal (see lesson-engine.js), answer, hint,
//            success text, and an optional scripted reply for the opponent before the next stage
//   play   – a practice game against a bot, optionally from a set position, with a goal

import { BUSY } from './lesson-boards.js';
import { read, puzzle, stage, play, G, ALL } from './lesson-dsl.js';
import { MORE_UNITS } from './lessons-more.js';

// Step builders live in lesson-dsl.js so the extra units (lessons-more.js) can share them.
export const UNITS = [
  // ===========================================================================
  {
    id: 'u1', title: 'The rules', blurb: 'Placing stones, five in a row, captures and the opening rule.',
    lessons: [
      {
        id: '1.1', title: 'Five in a row', summary: 'The main way to win, and the first thing to defend against.',
        steps: [
          read('How a game works', [
            'Pente is played on the points where the lines cross, not in the squares. Gold moves first and always starts on the centre point. After that, players take turns placing one stone anywhere that is empty.',
            'Make five or more of your stones in an unbroken line (across, up and down, or diagonally) and you win straight away.',
            'Stones never move once placed. They only leave the board when they are captured, which is the next lesson.',
          ], { p1: ['H7', 'J8', 'K9', 'L10', 'M11'], p2: ['K10', 'L9', 'J10'], hints: ['H7', 'M11'] }),
          puzzle('Finish the line', 1, { p1: ['K10', 'L10', 'M10', 'N10'], p2: ['K11', 'M8', 'L13'] }, [
            stage('You have four in a row. Place the fifth stone.', G('win'), 'O10',
              'A line can be finished from either end.', 'Five in a row. That wins the game.'),
          ]),
          puzzle('One way through', 1, { p1: ['G7', 'G8', 'G9', 'G10'], p2: ['G11', 'H9', 'F6'] }, [
            stage('Four in a column, but one end is taken. Find the winning point.', G('win'), 'G6',
              'Blue has blocked the top. What about the bottom?', 'Only one end was open, and you used it.'),
          ]),
          puzzle('Fill the gap', 2, { p1: ['H7', 'J8', 'L10', 'M11'], p2: ['K10', 'L9', 'N12'] }, [
            stage('Your diagonal has a hole in it. Win the game.', G('win'), 'K9',
              'Five in a row can be completed in the middle, not just at the ends.', 'A gap is just as good as an end.'),
          ]),
          puzzle('Stop the five', 2, { p1: ['J12', 'K10', 'L9'], p2: ['K12', 'L12', 'M12', 'N12'], toMove: 'p1' }, [
            stage('Blue has four in a row. Find the only move that stops them winning.', G('block'), 'O12',
              'You already block one end. Where would Blue\'s fifth stone go?', 'Blocked. Always check your opponent\'s lines before your own plans.'),
          ]),
          puzzle('Win or block?', 3, { p1: ['G6', 'H7', 'J8', 'K9', 'J12'], p2: ['F5', 'K12', 'L12', 'M12', 'N12'] }, [
            stage('Blue threatens to win next move. So do you. What do you play?', G('win'), 'L10',
              'If you can win right now, the opponent\'s threat doesn\'t matter.', 'Your five comes first, so Blue never gets to play theirs.'),
          ]),
        ],
      },
      {
        id: '1.2', title: 'Captures', summary: 'The second way to win, and why pairs are dangerous.',
        steps: [
          read('Bracketing a pair', [
            'If exactly two of your opponent\'s stones sit next to each other in a line, and you place stones on both ends, you capture them. Both stones come off the board.',
            'Capture five pairs (10 stones) and you win, even without five in a row.',
            'Only pairs can be captured. One stone or three in a row can\'t. And placing a stone between two enemy stones is always safe: you can\'t capture yourself.',
          ], { p1: ['K10'], p2: ['L10', 'M10'], hints: ['N10'] }),
          puzzle('Your first capture', 1, { p1: ['K10', 'H8'], p2: ['L10', 'M10', 'K12'] }, [
            stage('Capture the blue pair.', G('capture'), 'N10',
              'Your stone is already on one end of the pair.', 'Two stones captured. One pair down, four to go.'),
          ]),
          puzzle('On the diagonal', 1, { p1: ['J8', 'N7'], p2: ['K9', 'L10', 'H10'] }, [
            stage('Captures work along diagonals too. Find it.', G('capture'), 'M11',
              'Follow the line from your stone through the two blue stones.', 'Diagonal pairs are easy to miss. Keep an eye on them.'),
          ]),
          puzzle('Two at once', 2, { p1: ['J10', 'M13', 'F5'], p2: ['K10', 'L10', 'M11', 'M12', 'O7'] }, [
            stage('One move can capture two pairs. Find the point that brackets both.', G('capture', { min: 4 }), 'M10',
              'Look for the empty point at the end of both blue pairs.', 'Four stones in one move!'),
          ]),
          puzzle('Safe in the bracket', 2, { p1: ['L10', 'F14'], p2: ['K10', 'N10', 'M8', 'M9', 'M11', 'M12'] }, [
            stage('Blue threatens five down the M column. Block it, even though it means moving between two blue stones.', G('block'), 'M10',
              'Moving into a bracket can\'t get you captured.', 'Safe. You can only be captured when your opponent closes the bracket.'),
          ]),
          puzzle('The fifth capture', 3, { p1: ['E5', 'J12'], p2: ['F6', 'G7', 'K12', 'L12', 'M12', 'N12'], captured: { p1: 4, p2: 1 } }, [
            stage('You have captured four pairs. Blue threatens five in a row. Win the game.', G('win'), 'H8',
              'A fifth capture wins just as surely as five in a row.', 'Five captures. The blue threat never mattered.'),
          ]),
        ],
      },
      {
        id: '1.3', title: 'The opening rule', summary: 'How every game starts, and your first full game.',
        steps: [
          read('The tournament rule', [
            'Gold\'s first stone always goes on the centre point.',
            'Moving first is a real advantage, so serious games add one restriction: Gold\'s second stone must be at least three points away from the centre. The four star points around the centre mark that boundary.',
            'After that, both players can play anywhere.',
          ], { p1: ['K10'], p2: ['L11'], hints: ['K13', 'N13', 'N10', 'N7', 'K7', 'G7', 'G10', 'G13'] }),
          puzzle('Second stone', 1, { moves: ['K10', 'L11'] }, [
            stage('Place Gold\'s second stone where the tournament rule allows.', G('legal'), 'K13',
              'Count three points out from the centre in any direction.', 'Legal. Anything three or more points from the centre is allowed.'),
          ]),
          play('Your first game', 'Play a full game against Pip, the friendliest bot. Use everything from this unit: make five, capture pairs, and block Blue\'s lines.',
            { variantId: 'pente', level: 1, side: 'p1', coachMode: 'always' }),
        ],
      },
    ],
  },
  // ===========================================================================
  {
    id: 'u2', title: 'Shapes', blurb: 'Pairs, threes, fours and the double threat.',
    lessons: [
      {
        id: '2.1', title: 'Threes and trias', summary: 'The basic attacking shape, and the difference between open and closed.',
        steps: [
          read('Open threes', [
            'A tria is three stones in a row with empty points on both ends. It\'s a threat: next move it can become an open four, and an open four can\'t be blocked.',
            'If one end is already blocked, the three is closed and much weaker.',
            'A split three, like X_XX, works the same way: one more stone in the gap makes four.',
          ], { p1: ['K10', 'L10', 'M10'], hints: ['J10', 'N10'] }),
          puzzle('Make a tria', 1, { p1: ['K10', 'L10', 'F15'], p2: ['P4', 'C16', 'R17'] }, [
            stage('Turn your pair into an open three.', G('tria'), 'M10',
              'Add a stone touching either end.', 'An open three. Blue now has to deal with it.'),
          ]),
          puzzle('Open, not closed', 2, { p1: ['K10', 'L10', 'F15'], p2: ['N10', 'C16', 'R4'] }, [
            stage('Make an open three. Watch out: one side is blocked.', G('tria'), 'J10',
              'Blue sits at N10. A three touching it is closed.', 'Right. Grow your line away from the blocking stone.'),
          ]),
          puzzle('The split three', 2, { p1: ['K10', 'L10', 'F15'], p2: ['C4', 'R16', 'D16'] }, [
            stage('Make a split three: three stones with one gap, like X_XX.', G('split3'), 'N10',
              'Leave one empty point between your new stone and the pair.', 'A split three is just as threatening, and harder for beginners to spot.'),
          ]),
        ],
      },
      {
        id: '2.2', title: 'Fours and open fours', summary: 'Turning threes into threats that can\'t be stopped, and stopping them.',
        steps: [
          read('Four in a row', [
            'A four threatens five next move, so your opponent must answer it.',
            'An open four, with both ends empty, has two winning points. Your opponent can only block one, so an open four normally wins (unless they can capture part of it).',
            'That\'s why an open three must be blocked: if you wait, it becomes an open four.',
          ], { p1: ['K10', 'L10', 'M10', 'N10'], hints: ['J10', 'O10'] }),
          puzzle('Make it open', 1, { p1: ['K10', 'L10', 'M10', 'F15'], p2: ['C4', 'R16', 'D16', 'Q3'] }, [
            stage('Turn your tria into an open four.', G('openFour'), 'N10',
              'Add to either end.', 'An open four. Blue can only block one end.'),
          ]),
          puzzle('Block the tria', 2, { p1: ['F5', 'Q16'], p2: ['K12', 'L12', 'M12', 'D4'] }, [
            stage('Blue has an open three. Block it before it becomes an open four.', G('blockTria'), 'J12',
              'Block right next to an end. A stone one space away isn\'t enough.', 'Blocked. Now it\'s only a closed three.'),
          ]),
          puzzle('Block the safe end', 3, { p1: ['N11', 'F5', 'Q16'], p2: ['K12', 'L12', 'M12', 'N10', 'D4'] }, [
            stage('Block Blue\'s tria, but don\'t give them a pair to capture.', ALL(G('blockTria'), G('safe')), 'J12',
              'Blocking at N12 would put two gold stones in a row next to a blue stone.', 'Good. Both ends block the tria, but only one is safe.'),
          ]),
        ],
      },
      {
        id: '2.3', title: 'Double threats', summary: 'Two threats with one stone: how games are won.',
        steps: [
          read('Two at once', [
            'Your opponent can only answer one threat per move. Make two threats with one stone and one of them gets through.',
            'The strongest double threats are four-four (two fours) and four-three (a four plus an open three). After your opponent blocks the four, the three becomes an open four.',
            'Look for a point where two of your lines cross.',
          ], { p1: ['K10', 'L10', 'M10', 'N11', 'N12', 'N13'], p2: ['J10', 'N14'], hints: ['N10'] }),
          puzzle('Four-four', 3, { p1: ['K10', 'L10', 'M10', 'N11', 'N12', 'N13', 'F15'], p2: ['J10', 'N14', 'D4', 'Q4'] }, [
            stage('Make two fours with one stone.', G('forcedWin'), 'N10',
              'Where do the row and the column meet?', 'Two fours. Blue can only block one.'),
          ]),
          puzzle('Four-three', 3, { p1: ['K10', 'L10', 'M10', 'N11', 'N12', 'F15'], p2: ['J10', 'D4', 'Q4', 'R15'] }, [
            stage('Make a four and an open three at the same time.', G('forcedWin'), 'N10',
              'The same crossing point as before, but now the column only has two stones.', 'Four-three. After Blue blocks the four, your three becomes an open four.'),
          ]),
          puzzle('Block first, then strike', 4, { p1: ['D15', 'K10', 'L10', 'M10', 'N11', 'N12'], p2: ['E15', 'F15', 'G15', 'H15', 'J10', 'D4', 'Q4'] }, [
            stage('Blue threatens five. Deal with that first.', G('block'), 'J15',
              'Your own attack has to wait one move.', 'Blocked. Blue has to reply now…', 'G13'),
            stage('Blue played elsewhere. Now set up a win that can\'t be stopped.', G('forcedWin'), 'N10',
              'You used this crossing point in the last puzzle.', 'Four-three. Defence first, then attack: that\'s how strong players win.'),
          ]),
          play('Shapes in practice', 'Beat Juno (Level 2). Aim for trias you can turn into double threats, and block Juno\'s open threes early.',
            { variantId: 'pente', level: 2, side: 'p1', coachMode: 'quiet' }),
        ],
      },
    ],
  },
  // ===========================================================================
  {
    id: 'u3', title: 'Captures in play', blurb: 'Captures as defence, defending your pairs, and winning by captures.',
    lessons: [
      {
        id: '3.1', title: 'Captures as defence', summary: 'A capture can break a line that can\'t be blocked.',
        steps: [
          read('Break the line', [
            'An open four can\'t be blocked, but it can be broken. If one of its stones is part of a pair you can capture, capturing it removes the stone and the threat with it.',
            'A capture that also blocks or breaks a threat is twice as good: you gain a pair and a move.',
          ], { p1: ['M14'], p2: ['K12', 'L12', 'M12', 'N12', 'M13'], hints: ['M11'] }),
          puzzle('Break the open four', 2, { p1: ['M14', 'F5', 'Q16'], p2: ['K12', 'L12', 'M12', 'N12', 'M13', 'D4'] }, [
            stage('Blue has an open four. You can\'t block both ends, so find the capture that breaks it.', G('block'), 'M11',
              'Which blue stone in the four is also part of a pair?', 'The capture took M12 out of the line. Threat gone.'),
          ]),
          puzzle('Capture through the tria', 3, { p1: ['L14', 'F5', 'Q16'], p2: ['K12', 'L12', 'M12', 'L13', 'D4'] }, [
            stage('Stop Blue\'s tria with a capture instead of a block.', ALL(G('blockTria'), G('capture')), 'L11',
              'One stone of the tria has a blue partner above it.', 'You stopped the tria and won a pair in one move.'),
          ]),
          puzzle('Block with a threat', 3, { p1: ['F5', 'Q16'], p2: ['K12', 'L12', 'M12', 'N11', 'N10', 'D4'] }, [
            stage('Block the tria in a way that also threatens a capture.', ALL(G('blockTria'), G('capThreat')), 'N12',
              'One end of the tria touches a blue pair.', 'Blue now has to think about saving that pair too.'),
          ]),
        ],
      },
      {
        id: '3.2', title: 'Defending your pairs', summary: 'Four ways to save a pair, and how to choose.',
        steps: [
          read('When a pair is attacked', [
            'If your opponent has a stone on one end of your pair, they can capture it next move. You have four ways out:',
            '1. Extend it to three in a row (three can\'t be captured). 2. Put your own stone on the empty end. 3. Capture the attacking stone. 4. Make a bigger threat elsewhere, if you have one.',
            'Best of all is a move that saves the pair and builds something at the same time.',
          ], { p1: ['K10', 'L10'], p2: ['J10'], hints: ['M10'] }),
          puzzle('Save the pair', 1, { p1: ['K10', 'L10', 'F5'], p2: ['J10', 'Q16', 'D16'] }, [
            stage('Blue can capture your pair next move. Stop them.', G('noCaptures'), 'M10',
              'Three in a row can\'t be captured.', 'Safe. Extending also gave you a three.'),
          ]),
          puzzle('Capture the attacker', 2, { p1: ['K10', 'L10', 'J12', 'F5'], p2: ['J10', 'J11', 'Q16'] }, [
            stage('Save your pair by capturing the stone that threatens it.', ALL(G('capture'), G('noCaptures')), 'J9',
              'The attacking stone has a partner.', 'The attacker is gone, and you are a pair up.'),
          ]),
          puzzle('Two pairs, one move', 3, { p1: ['K10', 'L10', 'M11', 'M12', 'F5'], p2: ['J10', 'M13', 'Q16'] }, [
            stage('Two of your pairs are under attack. Save both with one stone.', G('noCaptures'), 'M10',
              'Find the empty point at the end of both pairs.', 'One stone, two threes. Both pairs are safe.'),
          ]),
        ],
      },
      {
        id: '3.3', title: 'Winning with captures', summary: 'Counting captures, and a capture that sets up a win.',
        steps: [
          read('Keep count', [
            'Every capture brings you closer to five. Near the end, a capture can matter more than any line on the board.',
            'Watch both counts: if your opponent has four captures, every pair you leave open could lose the game.',
          ]),
          puzzle('Race to five', 2, { p1: ['K8', 'C3'], p2: ['L9', 'M10', 'K12', 'L12', 'M12', 'N12', 'J12'], captured: { p1: 4, p2: 2 } }, [
            stage('Blue has an open four. You have four captures. Win.', G('win'), 'N11',
              'Find the blue pair you can close off.', 'Your fifth capture ends the game before Blue can finish.'),
          ]),
          puzzle('Save yourself, then win', 4,
            { p1: ['M14', 'M15', 'M16', 'J11', 'K11', 'L11', 'L13', 'N13', 'O13', 'F5'], p2: ['K12', 'L12', 'M12', 'N12', 'M13', 'H11', 'K13', 'D4', 'Q4'] }, [
              stage('Blue has an open four. Find the capture that saves you.', G('block'), 'M11',
                'One stone of Blue\'s four has a partner you can bracket.', 'Saved. And your capture also made a four, so Blue must block it…', 'N11'),
              stage('Blue had to block. Now the capture has opened a line for you. Set up a win that can\'t be stopped.', G('forcedWin'), 'M13',
                'The point you just emptied is the key.', 'Two fours at once. Blue can only stop one…', 'P13'),
              stage('Finish it.', G('win'), 'M12',
                'Your column is still open.', 'Five in a row. Capture to survive, then attack with the space it creates.'),
            ]),
          play('Capture practice', 'Beat Juno (Level 2) in Five + Captures, where you need a five and five captured pairs. It rewards everything in this unit.',
            { variantId: 'five-captures', options: { capturePairs: 5 }, level: 2, side: 'p1', coachMode: 'quiet' }),
        ],
      },
    ],
  },
  // ===========================================================================
  {
    id: 'u4', title: 'Initiative', blurb: 'Forcing moves, tempo, and when to attack instead of defend.',
    lessons: [
      {
        id: '4.1', title: 'Forcing moves', summary: 'Moves your opponent has to answer, and why they win games.',
        steps: [
          read('Keep them busy', [
            'A forcing move makes a threat your opponent has to answer: a four, an open three, or a capture threat.',
            'While they answer, they can\'t build their own threats. Whoever is making the threats has the initiative.',
            'Best of all: answer their threat with a move that makes a threat of your own.',
          ]),
          puzzle('Block with a tria', 2, { p1: ['N10', 'N11', 'F5', 'Q16'], p2: ['K12', 'L12', 'M12', 'D4', 'C15'] }, [
            stage('Blue has an open three. Block it and make an open three of your own.', ALL(G('blockTria'), G('tria')), 'N12',
              'One end of Blue\'s tria sits on top of your column.', 'Now Blue has to block you. You took the initiative back.'),
          ]),
          puzzle('Attack first', 3, { p1: ['K8', 'L8', 'M8', 'Q16'], p2: ['K12', 'L12', 'M12', 'D4'] }, [
            stage('You both have open threes and it\'s your move. Don\'t block: win.', G('forcedWin'), 'N8',
              'An open four beats an open three.', 'Your open four comes first. Blue\'s tria is too slow.'),
          ]),
          puzzle('Four, then finish', 4, { p1: ['K10', 'L10', 'M10', 'N12', 'N13', 'F5'], p2: ['J10', 'D4', 'Q4', 'R15'] }, [
            stage('Make a four that also builds toward your column.', ALL(G('four'), G('points', { points: ['N10'] })), 'N10',
              'Extend the row toward the N column.', 'Blue has to block the end…', 'O10'),
            stage('Now finish the job with one stone.', G('forcedWin'), 'N11',
              'Your column now has three stones and one gap.', 'An open four. The first four forced Blue\'s reply, and its stone built the second threat.'),
          ]),
        ],
      },
      {
        id: '4.2', title: 'Attack or defend?', summary: 'Reading the board before you move.',
        steps: [
          read('A simple order of questions', [
            'Before every move, ask in this order:',
            '1. Can I win now? 2. Can my opponent win next move? Then block. 3. Do I have a forced win (a chain of fours)? 4. Does my opponent have an open three or a capture threat? 5. Only then, build your own shape.',
          ]),
          puzzle('Their four beats your tria', 2, { p1: ['K8', 'L8', 'M8', 'J12'], p2: ['K12', 'L12', 'M12', 'N12', 'D4'] }, [
            stage('You have an open three. Blue has a four. What now?', G('block'), 'O12',
              'An open three is too slow when your opponent can win next move.', 'Right. Question 2 comes before your own attack.'),
          ]),
          puzzle('Block and save', 3, { p1: ['N11', 'N10', 'F5', 'Q16'], p2: ['K12', 'L12', 'M12', 'N9', 'D4'] }, [
            stage('Blue has an open three and is also threatening your pair. Fix both.', ALL(G('blockTria'), G('noCaptures')), 'N12',
              'Your pair is on the N column. Where does it meet Blue\'s tria?', 'One move: tria blocked, pair turned into a three.'),
          ]),
          play('Initiative practice', 'Beat Ludo (Level 3). Count threats before every move, and try to answer Ludo\'s threats with threats of your own.',
            { variantId: 'pente', level: 3, side: 'p1', coachMode: 'quiet' }),
        ],
      },
    ],
  },
  // ===========================================================================
  {
    id: 'u5', title: 'Openings', blurb: 'Good first moves as Gold and as Blue.',
    lessons: [
      {
        id: '5.1', title: 'Opening as Gold', summary: 'Using the first-move advantage under the tournament rule.',
        steps: [
          read('Gold\'s first moves', [
            'Gold starts in the centre, and the second stone must be three or more points away. Placing it on a straight or diagonal line through the centre keeps your two stones working together.',
            'Early on, avoid making pairs: Blue only needs one stone on the end to threaten them. Stones with a gap between them (X_X) can\'t be captured and can still become threes.',
            'Aim for flexible shapes: triangles and L-shapes of stones that can grow in several directions.',
          ], { p1: ['K10', 'K13'], p2: ['L11'], hints: ['K11', 'K12'] }),
          puzzle('A connected second stone', 1, { moves: ['K10', 'L11'] }, [
            stage('Place your second stone three points away, on a straight or diagonal line through the centre.', G('points', { points: ['K13', 'K7', 'N10', 'G10', 'N13', 'G7', 'N7', 'G13'] }), 'K13',
              'Three points straight up, down, sideways, or diagonally.', 'Your stones share a line, so they can work together.'),
          ]),
          puzzle('No easy pairs', 2, { moves: ['K10', 'L11', 'K13', 'L12'] }, [
            stage('Add a third stone near your others, without making a pair Blue can attack.', ALL(G('safe'), G('points', { points: ['J12', 'K11', 'K12', 'J11', 'H12', 'L9', 'M13', 'J13', 'L13', 'M10', 'J10', 'H11', 'L10', 'J9', 'L14', 'J14', 'M11', 'M12', 'H10', 'K14', 'K9', 'H13', 'N11', 'N12'] })), 'K11',
              'Filling a gap between your stones is often safe.', 'Safe and connected. Blue has nothing easy to attack.'),
          ]),
          play('Opening practice', 'Play Gold against Juno (Level 2). Use your first three moves to build a flexible shape with no pairs.',
            { variantId: 'pente', level: 2, side: 'p1', coachMode: 'quiet' }),
        ],
      },
      {
        id: '5.2', title: 'Opening as Blue', summary: 'Defending against the first-move advantage.',
        steps: [
          read('Blue\'s job', [
            'As Blue you start a move behind. Your first stones should get in Gold\'s way while staying flexible.',
            'Playing close to the centre (touching it, or one gap away) limits Gold\'s best shapes. When Gold\'s second stone lines up with the centre, a stone between them cuts that line.',
          ]),
          puzzle('Cut the line', 2, { moves: ['K10', 'L11', 'K13'] }, [
            stage('Gold\'s two stones share the K column. Cut the line between them.', G('points', { points: ['K11', 'K12'] }), 'K11',
              'Put your stone between the two gold stones.', 'The column is cut. Gold has to start a new line.'),
          ]),
          play('Playing Blue', 'Play Blue against Juno (Level 2). Moving second is harder, so aim to block early and counter-attack once Gold runs out of threats.',
            { variantId: 'pente', level: 2, side: 'p2', coachMode: 'quiet' }),
        ],
      },
      {
        id: '5.3', title: 'Opening shapes', summary: 'The hat: how strong players place their third stone.',
        steps: [
          read('Shapes, not pairs', [
            'Strong players almost never put their third stone next to one of their others. A pair is something Blue can attack, and attacking it gains Blue a tempo. Usually Gold only pairs up after Blue has made a pair first, and then the game turns into an exchange of captures.',
            'The favourite third-stone shape is the hat: two stones three points apart on a line, plus a third stone two points off that line and one point in from an end. No two stones touch, yet each pair of them shares a line with room to grow.',
            'Two more rules of thumb from strong players: lines across and up-and-down usually give more good follow-ups than diagonals, and stones near the centre favour Gold because they can grow in every direction.',
          ], { p1: ['K10', 'N10', 'M12'], p2: ['L11'], hints: ['L12', 'M8', 'L8'] }),
          puzzle('Build a hat', 2, { moves: ['K10', 'L11', 'N10', 'K12'] }, [
            stage('Your stones at K10 and N10 are three apart. Add a third stone to make a hat.', ALL(G('safe'), G('points', { points: ['M12', 'L12', 'M8', 'L8'] })), 'M12',
              'Two points above or below the row, one point in from either end.', 'A hat. Three stones, no pair, and three lines that can grow.'),
          ]),
          puzzle('A hat on a column', 2, { moves: ['K10', 'J9', 'K13', 'L12'] }, [
            stage('This time your stones are three apart on the K column. Make a hat.', ALL(G('safe'), G('points', { points: ['M12', 'M11', 'H12', 'H11'] })), 'M12',
              'Two columns to the side, one point in from the top or bottom stone.', 'Same shape, turned on its side.'),
          ]),
          play('Shapes in the opening', 'Play Gold against Ludo (Level 3). Make a hat or another pair-free shape with your third stone.',
            { variantId: 'pente', level: 3, side: 'p1', coachMode: 'quiet' }),
        ],
      },
    ],
  },
  // ===========================================================================
  {
    id: 'u6', title: 'Threat sequences', blurb: 'Chains of fours that end in a forced win, and how to stop them.',
    lessons: [
      {
        id: '6.1', title: 'Chains of fours', summary: 'Every move a threat, until the last one can\'t be stopped.',
        steps: [
          read('Victory by continuous fours', [
            'A chain of fours (strong players call it VCF) is a sequence where every one of your moves makes a four. Your opponent must block each one, so they never get a free move.',
            'The trick is that each four places a stone that helps the next one, until one move makes two fours at once.',
            'Before starting a chain, check that none of your stones in it can be captured: a capture is the only way out.',
          ], { p1: ['K8', 'L8', 'M8', 'K10', 'L10', 'M10', 'N9', 'N11'], p2: ['J8', 'J10', 'N12'], hints: ['N8', 'N10'] }),
          puzzle('Start the chain', 3,
            { p1: ['K8', 'L8', 'M8', 'K10', 'L10', 'M10', 'N9', 'N11', 'F15'], p2: ['J8', 'J10', 'N12', 'D4', 'Q4', 'R16'] }, [
              stage('There is a forced win here. Find the first four.', G('forcedWin'), 'N8',
                'A four on one row puts a stone into the N column.', 'That four starts a chain Blue can\'t escape.'),
            ]),
          puzzle('Play the whole chain', 4,
            { p1: ['K8', 'L8', 'M8', 'K10', 'L10', 'M10', 'N9', 'N11', 'F15'], p2: ['J8', 'J10', 'N12', 'D4', 'Q4', 'R16'] }, [
              stage('Make the first four.', ALL(G('four'), G('points', { points: ['N8'] })), 'N8',
                'Row 8 first.', 'Blue must block…', 'O8'),
              stage('Now make two fours at once.', G('forcedWin'), 'N10',
                'Row 10 and the N column cross here.', 'Double four. Blue blocks one…', 'O10'),
              stage('Finish.', G('win'), 'N7',
                'The N column is still open below.', 'Three moves, three threats, no reply. That\'s a chain of fours.'),
            ]),
          puzzle('Stop the fork', 4,
            { p1: ['J10', 'N14', 'D4', 'F15'], p2: ['K10', 'L10', 'M10', 'N11', 'N12', 'N13', 'Q4'], toMove: 'p1' }, [
              stage('Now it\'s Blue who is one move from a double four. Find a move that stops their forced win.', G('stopForced'), 'N10',
                'Blue\'s row and column cross at one empty point.', 'Taking the crossing point leaves Blue with single threats you can block one at a time.'),
            ]),
        ],
      },
      {
        id: '6.2', title: 'Save yourself, then win', summary: 'Turning a capture that saves you into an attack.',
        steps: [
          read('Defence that attacks', [
            'The best defensive moves leave you with the initiative. A capture that breaks a threat can also make a four of your own, and the space it empties can open a new line.',
            'In these puzzles, first find the move that saves you, then keep going until you win.',
          ]),
          puzzle('Capture, four, win', 4,
            { p1: ['M14', 'M15', 'M16', 'J11', 'K11', 'L11', 'L13', 'N13', 'O13', 'F5'], p2: ['K12', 'L12', 'M12', 'N12', 'M13', 'H11', 'K13', 'D4', 'Q4'] }, [
              stage('Blue threatens to win. Find the capture that saves you and makes a four.', ALL(G('block'), G('capture'), G('four')), 'M11',
                'Bracket the blue pair on the M column.', 'Saved, and Blue must block your new four…', 'N11'),
              stage('The capture emptied two points. Use one of them to make two threats.', G('forcedWin'), 'M13',
                'Row 13 and the M column cross at an empty point.', 'Double four…', 'P13'),
              stage('Win.', G('win'), 'M17',
                'Finish the column at either end.', 'From nearly lost to won in three moves.'),
            ]),
          play('Sequences in practice', 'Beat Ludo (Level 3). Before each move, look for a chain of fours, for both sides.',
            { variantId: 'pente', level: 3, side: 'p1', coachMode: 'quiet' }),
        ],
      },
    ],
  },
  // ===========================================================================
  {
    id: 'u7', title: 'Endgame', blurb: 'Capture races and closing out a won game.',
    lessons: [
      {
        id: '7.1', title: 'Capture races', summary: 'When both players are close to five captures.',
        steps: [
          read('Every pair counts', [
            'Once both players have three or four captures, the game changes. Any pair you leave open could be the last capture.',
            'Trading captures helps the defender: the attacker\'s combinations need stones that keep disappearing.',
            'Count before you move: how many captures does each side need, and who can get them first?',
          ]),
          puzzle('First to five', 3, { p1: ['K10', 'L10', 'F8', 'Q16'], p2: ['J10', 'G9', 'H10'], captured: { p1: 4, p2: 4 } }, [
            stage('Both of you have four captures. Blue threatens your pair. Win first.', G('win'), 'J11',
              'Is there a blue pair you can bracket right now?', 'Your fifth capture came first.'),
          ]),
          puzzle('Don\'t give them the fifth', 3, { p1: ['K10', 'L10', 'F5', 'Q16'], p2: ['J10', 'D4', 'R4'], captured: { p1: 2, p2: 4 } }, [
            stage('Blue has four captures and threatens your pair. Save it.', G('noCaptures'), 'M10',
              'If Blue captures, they win. Make the pair a three.', 'Safe. With four captures against you, every pair is an emergency.'),
          ]),
          puzzle('Capture through the four', 4, { p1: ['M14', 'F5', 'Q16'], p2: ['K12', 'L12', 'M12', 'N12', 'M13', 'D4'], captured: { p1: 4, p2: 4 } }, [
            stage('Blue has an open four and four captures. So do you. One move wins.', G('win'), 'M11',
              'The capture that breaks the four is also your fifth.', 'Fifth capture, game over.'),
          ]),
        ],
      },
      {
        id: '7.2', title: 'Closing out', summary: 'Converting a winning position without slipping.',
        steps: [
          read('Win safely', [
            'When you\'re ahead, the danger is a counter-attack: a capture that breaks your line, or a threat you didn\'t see.',
            'Before each finishing move, check: can my opponent win next move, and can any stone in my threat be captured?',
          ]),
          puzzle('Threat and shield', 4, { p1: ['K8', 'L8', 'M8', 'N9', 'N10', 'F5'], p2: ['N11', 'J8', 'D4', 'R16'], captured: { p1: 3, p2: 4 } }, [
            stage('Blue has four captures and threatens your N-column pair. Make a four that also saves the pair.', ALL(G('four'), G('noCaptures')), 'N8',
              'One point is on both your row 8 line and your N column.', 'Your pair became a three, and Blue must block your four.'),
          ]),
          play('Final test', 'Beat Vega (Level 4). Use everything: safe shapes, captures, forcing moves and chains of fours.',
            { variantId: 'pente', level: 4, side: 'p1', coachMode: 'quiet' }),
        ],
      },
    ],
  },
];

UNITS.push(...MORE_UNITS);

// Busy boards: each puzzle gets the generated clutter for its key (lesson id | title).
for (const u of UNITS) for (const l of u.lessons) for (const st of l.steps) {
  if (st.type === 'puzzle' && BUSY[`${l.id}|${st.title}`]) st.setup.extra = BUSY[`${l.id}|${st.title}`];
}

export const ALL_LESSONS = UNITS.flatMap((u) => u.lessons.map((l) => ({ ...l, unitId: u.id, unitTitle: u.title })));
export const getLesson = (id) => ALL_LESSONS.find((l) => l.id === id) || null;
export function nextLesson(id) {
  const i = ALL_LESSONS.findIndex((l) => l.id === id);
  return i >= 0 ? ALL_LESSONS[i + 1] || null : null;
}
