// Units 8 and 9: a lesson for every variant, and master-level ideas gathered from strong
// players (pente.org analysis forum, renju theory). All text is original writing; every
// puzzle is verified by tests/lessons.test.js like the rest.
import { read, puzzle, stage, play, G, ALL } from './lesson-dsl.js';
import { coordName, CENTER, parseCoord } from './rules.js';

const line = (...names) => names.map(parseCoord); // moves for a practice game that starts mid-opening

// G-Pente: legal second stones on the ring three points out (not on the centre's row or column).
const G_RING = [];
for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) !== 3 || dx === 0 || dy === 0) continue;
  G_RING.push(coordName(CENTER + dx, CENTER + dy));
}

export const MORE_UNITS = [
  // ===========================================================================
  {
    id: 'u8', title: 'Variant skills', blurb: 'Each variant bends one rule. Learn what changes, then use it.',
    lessons: [
      {
        id: '8.1', title: 'Keryo-Pente', summary: 'Threes can be captured too, so the safest Pente defence stops working.',
        steps: [
          read('What changes', [
            'In Keryo you can capture three stones in a row as well as two, by bracketing them the same way. Captures win at 15 stones.',
            'The big change is defensive. In Pente, a threatened pair is saved by stretching it into three. In Keryo that three can be captured, so the stretch just hands over three stones instead of two.',
            'Safe answers in Keryo: capture the attacking stone, make it four (four can\'t be captured), or block the open end with a threat of your own.',
            'Trains: defence, and checking every line of two or three stones before you leave it.',
          ], { p1: ['J10'], p2: ['K10', 'L10', 'M10'], hints: ['N10'] }),
          puzzle('Capture three', 2, { variant: 'keryo', p1: ['J10', 'F14', 'O6'], p2: ['K10', 'L10', 'M10', 'E5', 'Q15'] }, [
            stage('Blue has three in a row and your stone sits on one end. Capture all three.', G('capture', { min: 3 }), 'N10',
              'Bracket the three just like a pair.', 'Three stones in one capture. That only happens in Keryo.'),
          ]),
          puzzle('The stretch is a trap', 2, { variant: 'keryo', p1: ['K10', 'L10', 'J12', 'F5'], p2: ['J10', 'J11', 'Q16', 'R4'] }, [
            stage('Blue threatens your pair. Stretching it to three would only give Blue a trio to capture. Save it another way.', ALL(G('capture'), G('noCaptures')), 'J9',
              'The attacking stone has a partner, and your stone already sits above them.', 'You removed the attacker. In Keryo that is often the only safe answer.'),
          ]),
          puzzle('Make it four', 3, { variant: 'keryo', p1: ['K10', 'L10', 'N10', 'F5', 'Q15'], p2: ['J10', 'D15', 'R5'] }, [
            stage('Your pair is threatened again. Make a shape that can\'t be captured at all.', G('noCaptures'), 'M10',
              'Two and three can be captured in Keryo. Four can\'t.', 'Four in a row is safe, and it\'s a threat too.'),
          ]),
          puzzle('Capture through the four', 4, { variant: 'keryo', p1: ['K12', 'F5', 'Q16', 'D15'], p2: ['L12', 'M12', 'N12', 'M11', 'M13', 'M14', 'D4'] }, [
            stage('Blue has an open four down the M column. You can\'t block both ends, but one of its stones sits in a blue three. Break it.', G('block'), 'O12',
              'Look across row 12. Your stone is already on one end.', 'Capturing the three removed M12, so the four fell apart.'),
          ]),
          play('Keryo practice', 'Beat Juno (Level 2) at Keryo-Pente. Before every move, check your lines of two and three: are any of them bracketed on one side?',
            { variantId: 'keryo', level: 2, side: 'p1', coachMode: 'quiet' }),
        ],
      },
      {
        id: '8.2', title: 'Gomoku', summary: 'No captures and exactly five: pure threat reading.',
        steps: [
          read('What changes', [
            'Gomoku has no captures, so nothing can rescue a line once it is unstoppable. Fours and threes can only be blocked.',
            'Only exactly five wins. A line of six or more doesn\'t count, so a gap that would make six is not a real threat.',
            'Because no capture can break a chain of fours, Gomoku is the cleanest place to practise them: if a chain works, it works.',
            'Trains: threat sequences, and judging which threats are real.',
          ]),
          puzzle('Exactly five', 2, { variant: 'gomoku', p1: ['K10', 'L10', 'M10', 'N10', 'P10', 'F15'], p2: ['C4', 'R16', 'E14', 'K11'] }, [
            stage('You have four in a row and another stone just past the end. Find the move that wins.', G('win'), 'J10',
              'Filling O10 would make six. Six doesn\'t count in Gomoku.', 'Exactly five. The other end would have made six, which doesn\'t win.'),
          ]),
          puzzle('Which end matters?', 3, { variant: 'gomoku', p1: ['F5', 'Q4', 'D15', 'L13'], p2: ['K12', 'L12', 'M12', 'N12', 'P12', 'C3'], toMove: 'p1' }, [
            stage('Blue has four in a row. Only one end is a real threat. Block it.', G('block'), 'J12',
              'If Blue fills O12, how many stones is that in a row?', 'Right. O12 would give Blue six, which doesn\'t win, so J12 was the only threat.'),
          ]),
          puzzle('No escape', 4, { variant: 'gomoku', p1: ['K8', 'L8', 'M8', 'K10', 'L10', 'M10', 'N9', 'N11', 'F15'], p2: ['J8', 'J10', 'N12', 'D4', 'Q4', 'R16'] }, [
            stage('With no captures, Blue can\'t break any of your lines. Start a chain of fours that wins.', ALL(G('four'), G('forcedWin')), 'N8',
              'A four on row 8 also puts a stone in the N column.', 'It wins, and so would several other fours here. With no captures to rescue Blue, every sound chain of fours works.'),
          ]),
          play('Gomoku practice', 'Beat Juno (Level 2) at Gomoku. Without captures, look for chains of fours and four-threes.',
            { variantId: 'gomoku', level: 2, side: 'p1', coachMode: 'quiet' }),
        ],
      },
      {
        id: '8.3', title: 'G-Pente', summary: 'A stricter opening: the best-known second moves are banned.',
        steps: [
          read('What changes', [
            'G-Pente plays like Pente, except Gold\'s second stone has a tighter rule. It must be three or more points from the centre, and it can\'t sit three or four points out along the centre\'s own row or column.',
            'That takes away the straight-line openings that have been studied most, so both players have to build from a diagonal or an off-line stone.',
            'Trains: openings, and thinking for yourself early in the game.',
          ], { p1: ['K10'], hints: G_RING }),
          puzzle('A legal second stone', 1, { variant: 'g-pente', moves: ['K10', 'L11'] }, [
            stage('Place Gold\'s second stone three points from the centre, where G-Pente allows it.', G('points', { points: G_RING }), 'N13',
              'Three points out, but not straight up, down, left or right of the centre.', 'Legal. A diagonal second stone still lines up with the centre.'),
          ]),
          puzzle('Cut the diagonal', 2, { variant: 'g-pente', moves: ['K10', 'L9', 'N13'] }, [
            stage('Gold\'s two stones share a diagonal. As Blue, cut it.', G('points', { points: ['L11', 'M12'] }), 'L11',
              'Put your stone between the two gold stones on their diagonal.', 'Cut. Gold has to start a new line.'),
          ]),
          play('G-Pente practice', 'Play Juno (Level 2) at G-Pente. You get Gold or Blue at random: as Gold, use a diagonal second stone; as Blue, cut Gold\'s lines early.',
            { variantId: 'g-pente', level: 2, side: 'p1', coachMode: 'quiet' }),
        ],
      },
      {
        id: '8.4', title: 'Boat-Pente', summary: 'A five only wins if it survives one turn.',
        steps: [
          read('What changes', [
            'In Boat-Pente, if your opponent could capture a stone out of your new five, they get one turn to try. If the five is still standing after that turn, you win.',
            'So when you finish a five, check every stone in it: is any of them part of a pair with an open end?',
            'On defence, a five against you isn\'t the end. Look for a capture that breaks it, and ideally one that breaks it so badly it can\'t be rebuilt in one move.',
            'Trains: finishing safely, and captures as a last line of defence.',
          ]),
          puzzle('An unbreakable five', 3, { variant: 'boat', p1: ['K10', 'L10', 'M10', 'N10', 'O11', 'F5'], p2: ['O12', 'D15', 'Q4', 'H13'] }, [
            stage('Both ends of your four make five, but only one five can\'t be broken. Win.', G('win'), 'J10',
              'If you fill O10, which pair could Blue capture?', 'That five has no weak pair, so it wins at once.'),
          ]),
          puzzle('The fifth capture', 2,
            { variant: 'boat', p1: ['N14', 'F5', 'Q4'], p2: ['K12', 'L12', 'M12', 'N12', 'O12', 'N13', 'D16'], captured: { p1: 4, p2: 1 },
              pendingFive: { player: 'p2', cells: ['K12', 'L12', 'M12', 'N12', 'O12'] }, toMove: 'p1' }, [
              stage('Blue just made five, but one of its stones is in a pair you can capture, and you have four captures. Win.', G('win'), 'N11',
                'Bracket the blue pair on the N column.', 'Your fifth capture breaks the five and wins the game.'),
            ]),
          puzzle('Break it for good', 4,
            { variant: 'boat', p1: ['L12', 'O12', 'F5', 'Q16', 'D4'], p2: ['K10', 'L10', 'M10', 'N10', 'O10', 'L11', 'N11', 'R4'],
              pendingFive: { player: 'p2', cells: ['K10', 'L10', 'M10', 'N10', 'O10'] }, toMove: 'p1' }, [
              stage('Blue made five. One stone takes two stones out of it, so it can\'t be rebuilt in one move. Find it.', ALL(G('capture', { min: 4 }), G('block')), 'L9',
                'Find the point that brackets two blue pairs at once, one going up and one on the diagonal.', 'Two holes in the five. Blue can only fill one per turn.'),
            ]),
          play('Boat practice', 'Beat Juno (Level 2) at Boat-Pente. Before finishing a five, check that none of its stones can be captured.',
            { variantId: 'boat', level: 2, side: 'p1', coachMode: 'quiet' }),
        ],
      },
      {
        id: '8.5', title: 'Poof-Pente', summary: 'Moving into a bracket now gets your own stones captured.',
        steps: [
          read('What changes', [
            'In Poof-Pente, if your move makes a pair of your own stones that is bracketed by enemy stones, that pair "poofs" off the board and counts as a capture for your opponent.',
            'The usual comfort "placing between two enemy stones is safe" is gone. Before every block, look at the stones next to the point you\'re about to fill.',
            'Trains: awareness of your own weak shapes before you play them.',
          ], { p1: ['N11'], p2: ['N10', 'N13'], hints: ['N12'] }),
          puzzle('The end that poofs', 2, { variant: 'poof', p1: ['N11', 'F5', 'Q16'], p2: ['K12', 'L12', 'M12', 'N10', 'N13', 'D4'] }, [
            stage('Block Blue\'s open three. One end would poof your own stones.', G('blockTria'), 'J12',
              'At N12 your new stone would make a pair with N11, bracketed by blue above and below.', 'Safe block. At the other end your block would have vanished.'),
          ]),
          puzzle('The only block poofs', 3, { variant: 'poof', p1: ['O12', 'J11', 'N14', 'F5', 'Q16'], p2: ['K12', 'L12', 'M12', 'N12', 'J10', 'J13', 'N13', 'D4'], toMove: 'p1' }, [
            stage('Blue has four. The only empty end would poof your stone. Find another way to stop the five.', G('block'), 'N11',
              'One stone of the four has a blue partner on the N column, and your stone is above them.', 'The capture broke the four, and Blue can\'t finish it next move. (J14 also works: it makes J12 a poof point for Blue.)'),
          ]),
          play('Poof practice', 'Beat Juno (Level 2) at Poof-Pente. Before each block, check the points beside it for a poof.',
            { variantId: 'poof', level: 2, side: 'p1', coachMode: 'quiet' }),
        ],
      },
      {
        id: '8.6', title: 'Double Five', summary: 'Two fives in two different directions.',
        steps: [
          read('What changes', [
            'You need two fives, and they must run in different directions (they may share stones, like a cross). A five counts the moment you make it, even if stones are captured from it later.',
            'A line of six or more is still only one five. Extending your first five does nothing.',
            'After your first five, the board is full of your stones in one direction. The best second fives often cross the first one and use its stones.',
            'Or win by capturing eight pairs.',
            'Trains: sustained attack in more than one direction.',
          ]),
          puzzle('Bank the first five', 1, { variant: 'double-five', p1: ['K10', 'L10', 'M10', 'N10', 'F5'], p2: ['J10', 'Q16', 'D15'] }, [
            stage('Make your first five. It won\'t win yet, but it counts for good.', G('bank'), 'O10',
              'Only one end is open.', 'One five banked. Now you need one more in another direction.'),
          ]),
          puzzle('Six is still one', 3,
            { variant: 'double-five', p1: ['K10', 'L10', 'M10', 'N10', 'O10', 'M11', 'M12', 'M13', 'F5'], p2: ['J9', 'M9', 'Q16', 'D15', 'P11'],
              banked: { p1: [['K10', 'L10', 'M10', 'N10', 'O10']] } }, [
              stage('You already have a five across. Win with your second five.', G('win'), 'M14',
                'Lengthening the row makes six, which is still only one five. Use the column.', 'Two fives in two directions, sharing the M10 stone.'),
            ]),
          puzzle('Cross the first five', 4,
            { variant: 'double-five', p1: ['K10', 'L10', 'M10', 'N10', 'O10', 'N11', 'N12', 'L11', 'M12', 'F5'], p2: ['N14', 'N8', 'H8', 'J11', 'Q16', 'D15', 'P9'],
              banked: { p1: [['K10', 'L10', 'M10', 'N10', 'O10']] } }, [
              stage('Your first five is banked. Make two fours at once, both crossing it.', G('forcedWin'), 'N13',
                'One point finishes four on the N column and four on the diagonal from K10.', 'Two fours in two new directions. Blue can only block one.'),
            ]),
          play('Double Five practice', 'Beat Juno (Level 2) at Double Five. After your first five, build lines that cross it.',
            { variantId: 'double-five', level: 2, side: 'p1', coachMode: 'quiet' }),
        ],
      },
      {
        id: '8.7', title: 'Five + Captures', summary: 'You need a five and the capture target, so you must do both.',
        steps: [
          read('What changes', [
            'To win you need both a five in a row and the capture target (5, 8 or 10 pairs). A five counts once you make it, and from then on none of its stones can be captured.',
            'Count what each side still needs. A five is no threat from a player who is short on captures, and a capture is no threat from a player without a five.',
            'Trains: balance. Attacking alone or capturing alone won\'t win.',
          ]),
          puzzle('A five is not enough', 2,
            { variant: 'five-captures', options: { capturePairs: 5 }, p1: ['K10', 'L10', 'M10', 'N10', 'O10', 'Q15', 'F5'], p2: ['Q13', 'Q14', 'J10', 'D4', 'E15'],
              banked: { p1: [['K10', 'L10', 'M10', 'N10', 'O10']] }, captured: { p1: 4, p2: 1 } }, [
              stage('You have a five and four pairs. Win.', G('win'), 'Q12',
                'The last thing you need is a capture.', 'Five plus five pairs. That\'s the win.'),
            ]),
          puzzle('Their five counts too', 4,
            { variant: 'five-captures', options: { capturePairs: 5 }, p1: ['J12', 'O15', 'F6', 'G6', 'H6', 'J6', 'C16'], p2: ['K12', 'L12', 'M12', 'N12', 'O13', 'O14', 'R4', 'D10'],
              captured: { p1: 4, p2: 5 }, toMove: 'p1' }, [
              stage('Blue already has five pairs, so a blue five would win. Block it, and win your fifth pair with the same stone.', ALL(G('block'), G('capture')), 'O12',
                'The open end of Blue\'s four touches a blue pair.', 'Blocked, and now you have five pairs too. Blue has to stop your four…', 'E6'),
              stage('You have the captures. Now finish the five.', G('win'), 'K6',
                'Your row still has an open end.', 'Five and five pairs. Defend with the capture you need, then finish.'),
            ]),
          play('Five + Captures practice', 'Beat Ludo (Level 3) at Five + Captures with an 8-pair target. Keep count of what both of you still need.',
            { variantId: 'five-captures', options: { capturePairs: 8 }, level: 3, side: 'p1', coachMode: 'quiet' }),
        ],
      },
    ],
  },
  // ===========================================================================
  {
    id: 'u9', title: 'Master ideas', blurb: 'Keystones, bigger threats, double attacks and quiet moves.',
    lessons: [
      {
        id: '9.1', title: 'Keystones', summary: 'The stone that blocks a four is the one to capture.',
        steps: [
          read('The keystone', [
            'When a four is blocked, the blocking stone is holding the whole line back. Strong players call it a keystone.',
            'If the keystone is part of a pair, capturing that pair takes the block away, and the four is live again. If the same capture also makes a new four, there are two threats and the game is over.',
            'On defence, the reverse: when your stone blocks a four, guard its pairs as if the game depends on them. It does.',
          ], { p1: ['K10', 'L10', 'M10', 'N10', 'O12'], p2: ['J10', 'O10', 'O11'], hints: ['O9'] }),
          puzzle('Capture the keystone', 3, { p1: ['K10', 'L10', 'M10', 'N10', 'O12', 'F5', 'Q16'], p2: ['J10', 'O10', 'O11', 'D4', 'C15'] }, [
            stage('Your four is blocked at both ends. Take away one of the blocks.', ALL(G('capture'), G('four')), 'O9',
              'The blue stone at O10 has a partner above it, and your stone is above them both.', 'Keystone gone. Your four threatens five again.'),
          ]),
          puzzle('Guard your keystone', 3, { p1: ['J12', 'O12', 'O13', 'F5', 'Q4'], p2: ['K12', 'L12', 'M12', 'N12', 'O14', 'D15', 'R16'], toMove: 'p1' }, [
            stage('Your stone at O12 blocks Blue\'s four, but Blue is threatening to capture it. Keep the block.', G('noCaptures'), 'O11',
              'If O12 and O13 are captured, Blue\'s four is open again. Make them three.', 'The keystone is safe, so Blue\'s four stays dead.'),
          ]),
          puzzle('Double keystone', 4, { p1: ['K10', 'L10', 'M10', 'N10', 'O12', 'O6', 'O7', 'O8', 'F15'], p2: ['J10', 'O10', 'O11', 'O4', 'D4', 'Q16'] }, [
            stage('Capture the keystone so that it also makes a second four. Then Blue is lost.', ALL(G('capture'), G('forcedWin')), 'O9',
              'The capture point is also the top of your O column.', 'One capture, two threats at O10. Blue can\'t cover everything.'),
          ]),
          puzzle('Keystones and a three', 5,
            { p1: ['J13', 'J12', 'J11', 'J10', 'L10', 'M10', 'N10', 'M8', 'F15'], p2: ['J14', 'K10', 'O10', 'J9', 'K8', 'J7', 'L7', 'D4'] }, [
              stage('Blue has an open three on the diagonal. Ignore it. Two of Blue\'s stones each block one of your fours, and they form a pair. Find the move that wins.', G('forcedWin'), 'L11',
                'Threaten to capture both blockers, and build a three at the same time.', 'If Blue saves the pair, your diagonal becomes an open four. If not, one capture reopens two fours at once.'),
            ]),
        ],
      },
      {
        id: '9.2', title: 'Which end to block', summary: 'When a block will be captured either way, pick the end that costs less.',
        steps: [
          read('Block into the capture', [
            'Normally you block an open three on the end where your stone is safe. But sometimes one end will cost you a pair whichever end you choose.',
            'Here is how that happens. Block on the safe end, and your opponent stretches the three into a four at the other end. Now you must block there anyway, into the capture, and they take the pair with a stone that also lines up with their new four.',
            'So unless the safe end gives you something (a capture, a capture threat or a three of your own), block straight into the capture. You lose the same pair, but they get one move instead of two.',
          ]),
          puzzle('Block into the capture', 4, { p1: ['K9', 'J8', 'H7', 'K7', 'F15', 'Q16'], p2: ['K10', 'L10', 'M10', 'L8', 'D4', 'R15'] }, [
            stage('Blue has an open three. Blocking at J10 lets Blue capture J10 and K9. Blocking at N10 looks safe. Which is better?', ALL(G('blockTria'), G('points', { points: ['J10'] })), 'J10',
              'If you block at N10, Blue plays H10: a four you must block at J10, and then Blue captures anyway.', 'Right. Blue takes the pair now…', 'H11'),
            stage('Blue captured, so the three is open again. Block it.', G('blockTria'), 'N10',
              'Either end works now. Check that your block is safe.', 'You gave up one pair, but Blue spent a move to take it and has nothing extra.'),
          ]),
        ],
      },
      {
        id: '9.3', title: 'A bigger threat', summary: 'You don\'t always have to block. Answer with something stronger.',
        steps: [
          read('Strong players don\'t just block', [
            'When your opponent makes an open three, blocking an end is only one answer. Strong players list the others: make a four (it must be answered first), capture a stone out of the three, threaten a pair that sits in the three, or race to your fifth capture.',
            'The rule is simple: the bigger threat goes first. A five beats a four, a four beats an open three, and the side that makes the last forcing move wins the exchange.',
            'Best of all is one move that does two jobs: blocks their line and makes a threat of yours.',
            'A checklist before every move: Why did they play that? Do I have to answer, or do I have something bigger? Is there a free capture that weakens their best line? Can one stone serve two of my lines?',
          ]),
          puzzle('Block with a four', 3, { p1: ['N9', 'N10', 'N11', 'F5', 'Q16'], p2: ['K12', 'L12', 'M12', 'N8', 'D4', 'C15'] }, [
            stage('Blue has an open three. Block it with a move that also makes a four.', ALL(G('blockTria'), G('four')), 'N12',
              'One end of Blue\'s three sits on top of your column.', 'Blocked with a four. Blue has to answer you now.'),
          ]),
          puzzle('Ignore the three', 4, { p1: ['K8', 'L8', 'M8', 'K10', 'L10', 'M10', 'N9', 'N11', 'F15'], p2: ['J8', 'J10', 'N12', 'D4', 'Q4', 'R16', 'E14', 'F14', 'G14'] }, [
            stage('Blue has an open three on row 14. You have something much bigger. Start it with a four.', ALL(G('four'), G('forcedWin')), 'N8',
              'A chain of fours never gives Blue time to use their three.', 'Fours beat threes. Blue\'s three never got a move.'),
          ]),
          play('Pressure practice', 'Beat Vega (Level 4). When Vega makes an open three, look for a four or a capture before you block.',
            { variantId: 'pente', level: 4, side: 'p1', coachMode: 'quiet' }),
        ],
      },
      {
        id: '9.4', title: 'Double attacks on pairs', summary: 'One stone, two pairs threatened: one of them falls.',
        steps: [
          read('Two pairs at once', [
            'A stone that sits on the end of two enemy pairs threatens both. Your opponent can only save one, usually by stretching it into three.',
            'Before you play it, check the cost: does your stone become part of a pair they can capture back? And if they save a pair by stretching it, does the stretch give them a threat?',
            'Trading captures helps whoever is ahead on captures. If you\'re behind, protect first and attack later.',
          ]),
          puzzle('Fork two pairs', 3, { p1: ['O10', 'K14', 'F5', 'Q16'], p2: ['L10', 'M10', 'K11', 'K12', 'D4', 'R4'] }, [
            stage('Place one stone that threatens two blue pairs at once.', G('doubleCapThreat'), 'K10',
              'Find the point at the end of both pairs.', 'Two pairs threatened. Blue saves one…', 'K13'),
            stage('Take the other one.', G('capture'), 'N10',
              'Blue saved the K column. The row pair is still open.', 'A free pair, won by one well-placed stone.'),
          ]),
        ],
      },
      {
        id: '9.5', title: 'The quiet move', summary: 'A move with no threat that makes the next attack unstoppable.',
        steps: [
          read('The pause', [
            'Not every winning move is a threat. Sometimes the strongest move is quiet: it threatens nothing yet, but it sets up two different attacks, and your opponent can only stop one.',
            'Renju players call this the art of pause. It only works when your opponent has no forcing win of their own, so check that first.',
            'Quiet moves are hard to see for both players, which is exactly why they win games.',
          ]),
          puzzle('Set up two attacks', 5, { variant: 'gomoku', p1: ['K10', 'M7', 'L9', 'N11', 'N10', 'N7', 'K13', 'F15'], p2: ['L13', 'N13', 'M8', 'G10', 'D4', 'Q4', 'R16'] }, [
            stage('No captures here, so you can focus on the idea. Find the quiet move: no four, no open three, but it sets up two separate attacks Blue can\'t both stop.', ALL(G('quiet'), G('forcedWin')), 'K9',
              'Look for a point that adds a stone to your K column and to row 9 at the same time.', 'Quiet, but decisive: you now have a winning chain up the K column and another around N9. Blue can only stop one.'),
          ]),
          play('Master test', 'Beat Orion (Level 5), the strongest bot. Use everything: keystones, bigger threats, double attacks and quiet moves.',
            { variantId: 'pente', level: 5, side: 'p1', coachMode: 'off' }),
        ],
      },
    ],
  },
  // ===========================================================================
  {
    id: 'u10', title: 'Championship positions', blurb: 'Real positions from the 1983 World Championship. Play the champion\'s side and find the win.',
    lessons: [
      {
        id: '10.1', title: 'Finish like a champion', summary: 'Chains of three or four fours, found by the top players at the board.',
        steps: [
          read('From the 1983 World Championship', [
            'Every position in this unit comes from a real game at the 1983 World Pente Championship in Boston, where twenty of the best players in the world met. You can replay all the games in Review.',
            'In each one, the player to move had a forced win by a chain of fours, and found it. You play their side. Captures are live, so check that your chain can\'t be broken by one.',
            'These boards are busy because real games are. Read the whole board before you move: which lines are blocked, which pairs are hanging, and where your fours can run.',
          ]),
          puzzle('Game 12: Chen', 3, { moves: ["K10", "J10", "O10", "J8", "H12", "L9", "M10", "N10", "M8", "J11", "J9", "L11", "M9", "M11", "M7", "M6", "K11", "L10", "N11", "M11", "K9", "H9", "K9"] }, [
            stage('Round 1, game 12. Hai-Chou Chen (Blue) to play against Brad Beatty. Find the chain of fours that wins.', ALL(G('four'), G('forcedWin')), 'J9',
              'Look up and down the J column.', 'Chen found it at the board: J9 starts a chain of fours that Beatty couldn\'t stop.'),
          ]),
          puzzle('Game 72: Colbert', 3, { moves: ["K10", "L7", "K7", "L9", "L8", "M9", "K9", "J6", "N9", "L9", "K11", "K12", "M10", "L10", "K7", "K8", "J7", "H7", "L9", "J9"] }, [
            stage('Round 4, game 72. Robert Colbert (Gold) to play against David Comberrel. Find the chain of fours that wins.', ALL(G('four'), G('forcedWin')), 'M9',
              'Your first four runs along row 9.', 'Colbert found it at the board: M9 starts a chain of fours that Comberrel couldn\'t stop.'),
          ]),
          puzzle('Game 20: Cooper', 4, { moves: ["K10", "L11", "N10", "N11", "K12", "M11", "K11", "K9", "L10", "P11", "O11", "M9", "J10", "J12", "L10", "P12", "O11", "K11", "H13", "K11", "J11", "J12", "L9", "J9", "J11", "L8", "L9"] }, [
            stage('Round 1, game 20. Marvin Cooper (Blue) to play against Brian Silberberg. Find the chain of fours that wins.', ALL(G('four'), G('forcedWin')), 'L10',
              'Your first four runs diagonally, down and to the right.', 'Cooper found it at the board: L10 starts a chain of fours that Silberberg couldn\'t stop.'),
          ]),
          puzzle('Game 37: Beatty', 4, { moves: ["K10", "J9", "G10", "J11", "J8", "F11", "G11", "G9", "G12", "H9", "F9", "K9", "L9", "M8", "L9", "E8", "H11", "E7", "J12", "K13", "G14", "G13", "F13"] }, [
            stage('Round 2, game 37. Brad Beatty (Blue) to play against Brent Rustad. Find the chain of fours that wins.', ALL(G('four'), G('forcedWin')), 'F8',
              'Your first four runs diagonally, up and to the right.', 'Beatty found it at the board: F8 starts a chain of fours that Rustad couldn\'t stop.'),
          ]),
          puzzle('Game 51: Webber', 4, { moves: ["K10", "J10", "F10", "L9", "H8", "J9", "J8", "K8", "J11", "J7", "H6", "N9", "H7", "G8", "H8", "H9", "H5", "H4", "J10", "H12", "F7", "H9", "G10", "E10", "K10", "H10", "H11", "H9", "H10", "G10", "M10", "L10", "L8", "L11"] }, [
            stage('Round 3, game 51. Bill Webber (Gold) to play against Bill Justice. Find the chain of fours that wins.', ALL(G('four'), G('forcedWin')), 'G12',
              'Your first four runs diagonally, down and to the right.', 'Webber found it at the board: G12 starts a chain of fours that Justice couldn\'t stop.'),
          ]),
        ],
      },
      {
        id: '10.2', title: 'Long chains', summary: 'Five and six moves deep: the kind of calculation that wins championships.',
        steps: [
          read('Calculating further', [
            'These chains are longer. Before you play the first four, picture the whole sequence: where your opponent must block each time, and what that blocking stone does. A block that lands on one of your other lines can end the attack.',
            'Watch the capture counts too. If your opponent can capture a stone out of one of your fours, the chain breaks there.',
            'Two of these positions come from Rollie Tesh\'s games: he won the championship, and in one of them he is the one who gets caught.',
          ]),
          puzzle('Game 45: Cooper', 4, { moves: ["K10", "L9", "O10", "L11", "M10", "L10", "L12", "L8", "L7", "N10", "O12", "M9", "O11", "O9", "O13", "O14", "N9", "O8", "O7", "O9", "N9", "P11", "M8", "K6", "K9", "L9", "P8", "N6", "M11", "O9", "K13", "J14"] }, [
            stage('Round 3, game 45. Marvin Cooper (Gold) to play against John Hawkins. Find the chain of fours that wins.', ALL(G('four'), G('forcedWin')), 'K11',
              'Start on the K column.', 'Cooper found it at the board: K11 starts a chain of fours that Hawkins couldn\'t stop.'),
          ]),
          puzzle('Game 89: Colbert', 5, { moves: ["K10", "J9", "G10", "G9", "H9", "J8", "J10", "F11", "J7", "H10", "J11", "J9", "L9", "J12", "J11", "H12", "K8", "M10", "K6", "G12"] }, [
            stage('Round 5, game 89. Robert Colbert (Gold) to play against Marvin Cooper. Find the chain of fours that wins.', ALL(G('four'), G('forcedWin')), 'K7',
              'Start on the K column. More than one four works here; find any chain that wins.', 'Colbert found it at the board: K7 starts a chain of fours that Cooper couldn\'t stop.'),
          ]),
          puzzle('Game 64: Tesh', 5, { moves: ["K10", "L11", "N12", "N11", "K9", "K11", "M11", "K8", "L10", "K9", "O13", "P14", "K10", "J11", "K7", "K9", "M10", "M9", "M12", "H11", "G11", "J10", "N10", "O10", "P9", "O10", "G12", "J9", "H9"] }, [
            stage('Round 4, game 64. Rollie Tesh (Blue) to play against Marvin Cooper. Find the chain of fours that wins.', ALL(G('four'), G('forcedWin')), 'L9',
              'Your first four runs along row 9.', 'Tesh found it at the board: L9 starts a chain of fours that Cooper couldn\'t stop.'),
          ]),
          puzzle('Game 82: Wallace', 5, { moves: ["K10", "K11", "G10", "H13", "J12", "K13", "J10", "H10", "J13", "J11", "G9", "K12", "G11", "G12", "F11"] }, [
            stage('Round 5, game 82. Dave Wallace (Blue) to play against Rollie Tesh. Find the chain of fours that wins.', ALL(G('four'), G('forcedWin')), 'K15',
              'Start on the K column.', 'Wallace found it at the board: K15 starts a chain of fours that Tesh couldn\'t stop.'),
          ]),
          puzzle('Game 16: Hudson', 5, { moves: ["K10", "J11", "G10", "G11", "H11", "J9", "J12", "F9", "K13", "L14", "K12", "K11", "L11", "K11", "H12", "K14", "K12", "L12"] }, [
            stage('Round 1, game 16. Peter Hudson (Gold) to play against Ken Krenz. Find the chain of fours that wins.', ALL(G('four'), G('forcedWin')), 'F12',
              'Your first four runs along row 12.', 'Hudson found it at the board: F12 starts a chain of fours that Krenz couldn\'t stop.'),
          ]),
        ],
      },
    ],
  },
  // ===========================================================================
  {
    id: 'u11', title: 'Openings of the masters', blurb: 'The openings the 1983 world championship was fought with, and what the numbers say about them.',
    lessons: [
      {
        id: '11.1', title: 'The Wedge', summary: 'The most played opening of 1983, and Gold\'s best weapon.',
        steps: [
          read('Gold\'s favourite', [
            'Blue answers the centre with a stone touching it diagonally. Gold puts the second stone three points to the side, and Blue sits right on top of it. Gold\'s third stone then goes into the gap between Blue\'s two stones, one point up from the row. That is the Wedge.',
            'The wedge stone splits Blue\'s two stones and lines up with both of Gold\'s, but it also lives between enemy stones, so captures start early. In the main line both sides lose pairs before move ten, and the game becomes a fight over who keeps their last pairs safe.',
            'In 1983 it was the most played opening by far: 34 of the 109 games, and Gold won 71% of them. In the main line, Blue almost always answered with the stone just above its own (24 of 27 games), and Gold always replied by touching the centre from the side, right under Blue\'s new column (24 of 24).',
            'Learn the first nine moves of the main line, then the tactics that came up in real Wedge games.',
          ], { p1: ['K10', 'N10', 'M11'], p2: ['L11', 'N11'], hints: ['M11'] }),
          puzzle('Gold\'s third stone', 1, { moves: ['K10', 'L11', 'N10', 'N11'] }, [
            stage('Blue has answered on the diagonal and on top of Gold\'s second stone. Play Gold\'s third stone the way the 1983 masters did.', G('points', { points: ['M11'] }), 'M11',
              'Slip into the gap between Blue\'s two stones.', 'That\'s the Wedge. Gold played it in 34 games and won 71% of them.'),
          ]),
          puzzle('Blue\'s usual answer', 1, { moves: ['K10', 'L11', 'N10', 'N11', 'M11'] }, [
            stage('Now you are Blue. In 24 of 27 Wedge games, Blue answered with the same move. Find it.', G('points', { points: ['L12'] }), 'L12',
              'Stack a stone on top of your first stone.', 'The main line. It defends and prepares an attack on Gold\'s pairs.'),
          ]),
          puzzle('Gold touches the centre', 1, { moves: ['K10', 'L11', 'N10', 'N11', 'M11', 'L12'] }, [
            stage('Gold again. Every master in this position played the same move. Find it.', G('points', { points: ['L10'] }), 'L10',
              'Touch the centre stone from the side, under Blue\'s column.', 'Gold\'s stones now form a solid row with the wedge stone above it.'),
          ]),
          puzzle('Game 10: Hawkins', 2, { moves: ["K10","L9","K7","L7","L8","M9","K9","J6","K11","K8","M6","J7","N9"] }, [
            stage('Round 1, game 10. You are Hawkins (Blue). Justice threatens to capture one of your pairs. Save it without letting them start a winning attack.', {all: [{kind: 'noCaptures'},{kind: 'stopForced'}]}, 'J9',
              'Extend, block the open end, or capture the attacker.', 'Hawkins found it at the board.'),
          ]),
          puzzle('Game 33: Hawkins', 3, { moves: ["K10","L11","N10","N11","M11","L12","L10","O9","L13","J10","M10","M9","L11","L12","N9","L9","L11","K12","J9","M12","O10","M12","J12","P10","P7","O8"] }, [
            stage('Round 2, game 33. You are Hawkins (Gold). One capture takes away a stone that blocks your line and makes a four at the same time. Find it.', {all: [{kind: 'capture'},{kind: 'four'}]}, 'O7',
              'Look at the stones blocking your lines. Is one of them part of a pair?', 'Hawkins found it at the board.'),
          ]),
          puzzle('Game 30: Comberrel', 4, { moves: ["K10","L11","K13","L13","L12","M11","K11","J14","N11","K12","J11","K9","M14","M11","L9","L10"] }, [
            stage('Round 2, game 30. You are Comberrel (Gold). Tesh has a winning chain of fours ready. Find the move that stops it.', {kind: 'stopForced'}, 'J8',
              'Find the stone their first four needs, or a capture that breaks their line.', 'Comberrel found it at the board.'),
          ]),
          play('Play the Wedge', 'Play the Wedge\'s main line against Vega (Level 4). You get Gold or Blue at random, so you learn both sides of the opening. The captures start right away, so keep your pairs covered.',
            { variantId: 'pente', level: 4, side: 'p1', coachMode: 'quiet', moves: line('K10', 'L11', 'N10', 'N11', 'M11', 'L12') }),
        ],
      },
      {
        id: '11.2', title: 'The Hammer', summary: 'Why Gold avoids one natural move, and how Blue punishes it.',
        steps: [
          read('A natural move that loses', [
            'Same start as the Wedge: Blue touches the centre diagonally and sits on top of Gold\'s second stone. But this time Gold\'s third stone goes two points straight above the centre.',
            'It looks harmless, but Blue fills the gap between its two stones and has three in a row at once, aimed at Gold\'s side of the board. The strong players called Blue\'s shape the hammer.',
            'In 1983, Gold won only 22% of the games where this came up (2 of 9). Players learned to stop it: the Wedge, for example, takes the gap point first.',
          ], { p1: ['K10', 'N10', 'K12'], p2: ['L11', 'N11'], hints: ['M11'] }),
          puzzle('Swing the hammer', 1, { moves: ['K10', 'L11', 'N10', 'N11', 'K12'] }, [
            stage('You are Blue. Gold\'s third stone missed the key point. Take it.', ALL(G('tria'), G('points', { points: ['M11'] })), 'M11',
              'Fill the gap between your two stones.', 'An open three, and Gold has to answer it. In 1983 Blue won 4 of the 5 games that reached this point.'),
          ]),
          puzzle('Gold takes the key point', 1, { moves: ['K10', 'L11', 'N10', 'N11'] }, [
            stage('Gold to play. Which point stops Blue from ever forming the hammer?', G('points', { points: ['M11'] }), 'M11',
              'Where would Blue fill in to make three?', 'Taking the gap first is exactly the Wedge. Same point, opposite purpose.'),
          ]),
          puzzle('Game 38: Rustad', 2, { moves: ["K10","N11","N10","L11","K12","L9","K11","K9","K13","K14","M9","M10","J9","H8","N9","N8","H13","M12","L13","J13","J12","L10","H12","H11","L15"] }, [
            stage('Round 2, game 38. You are Rustad (Blue). You can capture more than one pair, but only one capture is safe. Find it.', {all: [{kind: 'capture'},{kind: 'safe'},{kind: 'stopForced'}]}, 'L14',
              'After each capture, check what your opponent can capture back or attack.', 'Rustad found it at the board.'),
          ]),
          puzzle('Game 68: Webber', 3, { moves: ["K10","L11","K13","L13","M10","L12","L10","J10","J11","H12","M8","L9","N10","O10","K11","J12","K12"] }, [
            stage('Round 4, game 68. You are Webber (Blue). One capture takes away a stone that blocks your line and makes a four at the same time. Find it.', {all: [{kind: 'capture'},{kind: 'four'}]}, 'M9',
              'Look at the stones blocking your lines. Is one of them part of a pair?', 'Webber found it at the board.'),
          ]),
          puzzle('Game 7: Wallace', 4, { moves: ["K10","L11","K13","L13","M10","L12","L10","J10","M12","K11","M13","L15","L14","K15","N12","O12","N12","M15","N10","O10"] }, [
            stage('Round 1, game 7. You are Wallace (Gold). Find the chain of fours that wins.', {all: [{kind: 'four'},{kind: 'forcedWin'}]}, 'O11',
              'Every move has to make a four.', 'Wallace found it at the board.'),
          ]),
          puzzle('Game 68: Webber', 4, { moves: ["K10","L11","K13","L13","M10","L12","L10","J10","J11","H12","M8","L9","N10","O10","K11","J12","K12","M9","L10","L15","L14","M15","L14","K9","J9"] }, [
            stage('Round 4, game 68. You are Webber (Blue). Find the chain of fours that wins.', {all: [{kind: 'four'},{kind: 'forcedWin'}]}, 'O9',
              'Every move has to make a four.', 'Webber found it at the board.'),
          ]),
          play('Play the hammer', 'Play Vega (Level 4) from the position where Gold has just played K12. You get Gold or Blue at random: as Blue, swing the hammer; as Gold, survive it.',
            { variantId: 'pente', level: 4, side: 'p2', coachMode: 'quiet', moves: line('K10', 'L11', 'N10', 'N11', 'K12') }),
        ],
      },
      {
        id: '11.3', title: 'Wallace\'s opening', summary: 'A Blue system that beat Gold five times in six.',
        steps: [
          read('Blue strikes from a distance', [
            'Blue touches the centre from directly above. When Gold puts the second stone three points to the side, Blue doesn\'t follow it: Blue plays two to the side and three up, far from everything.',
            'The far stone doesn\'t block anything yet. It waits to combine with Blue\'s first stone, so Gold\'s natural developing moves can run into it.',
            'It is named after Dave Wallace, and in 1983 Gold won only 1 of the 6 games that followed this line. After Gold\'s most common reply, Blue built a column next to the centre and won all three of those games.',
          ], { p1: ['K10', 'N10'], p2: ['K11', 'M13'], hints: ['M13'] }),
          puzzle('The surprise stone', 1, { moves: ['K10', 'K11', 'N10'] }, [
            stage('You are Blue. Play Wallace\'s far-off second stone.', G('points', { points: ['M13'] }), 'M13',
              'Two points to the right and three up from the centre.', 'Far from the action now, but it lines up with your first stone.'),
          ]),
          puzzle('Wallace\'s follow-up', 1, { moves: ['K10', 'K11', 'N10', 'M13', 'L12'] }, [
            stage('Gold played between your stones, as most masters did. Blue answered the same way every time it won. Find it.', G('points', { points: ['K13'] }), 'K13',
              'Grow the column above the centre.', 'Blue won all three games with this move.'),
          ]),
          puzzle('Game 8: Webber', 2, { moves: ["K10","K9","N10","M7","L8","K7","L10","M10","L9","L7","N7","J10"] }, [
            stage('Round 1, game 8. You are Webber (Gold). Wallace threatens to capture one of your pairs. Save it without letting them start a winning attack.', {all: [{kind: 'noCaptures'},{kind: 'stopForced'}]}, 'L10',
              'Extend, block the open end, or capture the attacker.', 'Webber found it at the board.'),
          ]),
          puzzle('Game 48: Wallace', 3, { moves: ["K10","K11","G10","H13","G12","J12","G14","M9","L10","J10","G11","G13","F13","J13","J11","L12","H9","N14","M13","K13","J14","J13","M11","K13","L13"] }, [
            stage('Round 3, game 48. You are Wallace (Blue). One capture takes away a stone that blocks your line and makes a four at the same time. Find it.', {all: [{kind: 'capture'},{kind: 'four'}]}, 'N13',
              'Look at the stones blocking your lines. Is one of them part of a pair?', 'Wallace found it at the board.'),
          ]),
          puzzle('Game 66: Hawkins', 5, { moves: ["K10","J10","K13","G12","H11","J12","H13","J11","J13","L13","J9","L11","H10","H9","H12","H14","K11","K14","G8","G11"] }, [
            stage('Round 4, game 66. You are Hawkins (Gold). Find the chain of fours that wins.', {all: [{kind: 'four'},{kind: 'forcedWin'}]}, 'H9',
              'Every move has to make a four.', 'Hawkins found it at the board.'),
          ]),
          play('Play Wallace\'s opening', 'Play Vega (Level 4) from this position. You get Gold or Blue at random: as Blue, play Wallace\'s system; as Gold, find a way to break it.',
            { variantId: 'pente', level: 4, side: 'p2', coachMode: 'quiet', moves: line('K10', 'K11', 'N10', 'M13', 'L12') }),
        ],
      },
      {
        id: '11.4', title: 'Choosing your opening', summary: 'What the numbers say, and openings for both sides.',
        steps: [
          read('By the numbers', [
            'Across all 109 games, Gold won 57%: moving first is an advantage even with the tournament rule.',
            'Gold\'s second stone went three points out in a straight line in 77 games, and four out in 25. The results were the same (56% either way), so the choice is about style: three out keeps the stones in touch, four out keeps more space.',
            'Openings that helped Gold most: the Wedge (71% of 34 games) and the Potential, where Blue\'s first stone goes two points from the centre instead of touching it (Gold won 4 of 5). Openings that helped Blue most: the Hammer and Wallace\'s opening (Gold won 22% and 14%).',
            'Explore every opening and its main lines in Review, under 1983 World Championship → Insights.',
          ]),
          puzzle('Name the opening', 1, { moves: ['K10', 'L11', 'N10', 'N11'] }, [
            stage('Gold to play. Which third stone starts the opening Gold won 71% of the time with?', G('points', { points: ['M11'] }), 'M11',
              'The most played opening of 1983.', 'The Wedge.'),
          ]),
          play('Your choice', 'Play Vega (Level 4). You get Gold or Blue at random: use one of the openings from this unit, or the right answer to it. Afterwards, check the game in Review to see how it compares with the masters.',
            { variantId: 'pente', level: 4, side: 'p1', coachMode: 'quiet' }),
        ],
      },
    ],
  },
];
