// Variant definitions. Every variant is one configuration of the same rules engine.
// Each also carries the plain-language rules and the skill it trains, shown in the app.
//
// Engine settings:
//   captureSizes              lengths of enemy lines you can capture by bracketing ([] = no captures)
//   captureWinStones          captured stones needed to win (null = captures never win on their own)
//   fivesToWin                fives needed to win
//   fivesMustDifferInDirection  extra fives only count if they run in a new direction
//   requireFiveAndCaptures    a win needs a five AND captureWinStones captured stones
//   lockBankedFives           stones of a banked five can't be captured (Five + Captures)
//   overlineWins              does six-or-more in a row count as a five?
//   boat                      a five only wins if it survives the opponent's next move
//   poof                      moving into a bracket gets your own stones captured
//   opening                   'center' | 'tournament' | 'g-pente' | 'free'
//   choice                    'd-pente' | 'swap2': a set-up, then a choice of sides (see openings.js)
//   lineToWin                 stones in a row that win (5; Connect6 uses 6)
//   twoStones                 Connect6 turns: one stone first, then two stones a turn (bot in connect6.js)

const BASE = {
  captureSizes: [2],
  captureWinStones: 10,
  fivesToWin: 1,
  fivesMustDifferInDirection: false,
  requireFiveAndCaptures: false,
  overlineWins: true,
  boat: false,
  poof: false,
  opening: 'tournament',
};

export const VARIANTS = [
  {
    id: 'pente',
    name: 'Pente',
    tagline: 'The classic game.',
    trains: 'The whole game: attack, defence and captures working together.',
    rules: [
      'Take turns placing a stone on any empty point. The first stone goes on the centre.',
      'Win by making five or more in a row: across, down or diagonal.',
      'Or win by capturing five pairs (10 stones).',
      'To capture, bracket exactly two of your opponent\'s stones in a line with your own. Both come off the board.',
      'Placing a stone into a bracket is safe: you can\'t be captured by your own move.',
      'Tournament rule: the first player\'s second stone must be at least 3 points away from the centre.',
    ],
    config: { ...BASE },
  },
  {
    id: 'keryo',
    name: 'Keryo-Pente',
    tagline: 'Pairs and threes can both be captured.',
    trains: 'Defence. Stretching a threatened pair into three no longer keeps it safe.',
    rules: [
      'Same as Pente, except you can also capture exactly three stones in a row by bracketing them.',
      'Captures win at 15 stones instead of 10.',
      'Five or more in a row still wins.',
    ],
    config: { ...BASE, captureSizes: [2, 3], captureWinStones: 15 },
  },
  {
    id: 'gomoku',
    name: 'Gomoku',
    tagline: 'No captures. Exactly five wins.',
    trains: 'Pure threat sequences, with no captures to bail either side out.',
    rules: [
      'There are no captures.',
      'Win by making exactly five in a row. Six or more does not count.',
      'The first stone goes on the centre; there is no tournament rule.',
    ],
    config: { ...BASE, captureSizes: [], captureWinStones: null, overlineWins: false, opening: 'center' },
  },
  {
    id: 'g-pente',
    name: 'G-Pente',
    tagline: 'Pente with a stricter opening.',
    trains: 'Openings. The most-studied second moves are off the table, so you have to think for yourself.',
    rules: [
      'Same as Pente.',
      'The first player\'s second stone must be at least 3 points from the centre, and it can\'t sit 3 or 4 points away along the centre\'s own row or column.',
    ],
    config: { ...BASE, opening: 'g-pente' },
  },
  {
    id: 'boat',
    name: 'Boat-Pente',
    tagline: 'A five has to survive one turn.',
    trains: 'Finishing safely, and using captures as defence against a five.',
    rules: [
      'Same as Pente, except a five doesn\'t win straight away if your opponent can break it.',
      'If your opponent could capture a stone out of your five on their next move, they get that one turn to try.',
      'If the five is still standing after their move, you win.',
      'Five captures still wins.',
    ],
    config: { ...BASE, boat: true },
  },
  {
    id: 'poof',
    name: 'Poof-Pente',
    tagline: 'Moving into a bracket is no longer safe.',
    trains: 'Awareness of your own weak shapes before you play them.',
    rules: [
      'Same as Pente, except if your move makes a pair of your own that is bracketed by enemy stones, that pair "poofs" off the board.',
      'Poofed stones count as captures for your opponent.',
      'Your own captures and poofs happen at the same time.',
      'If both players reach 10 captured stones on the same move with a tie, play continues until one leads.',
    ],
    config: { ...BASE, poof: true },
  },
  {
    id: 'double-five',
    name: 'Double Five',
    tagline: 'Two fives, in two different directions.',
    trains: 'Sustained attack: building threats in more than one direction at once.',
    rules: [
      'Win by making two fives that run in different directions. They may share stones, as in a cross.',
      'A straight line of six or more counts as one five, not two.',
      'A five counts as soon as you make it, and from then on its stones can\'t be captured.',
      'Or win by capturing eight pairs (16 stones).',
      'Tournament rule applies.',
    ],
    config: { ...BASE, fivesToWin: 2, fivesMustDifferInDirection: true, captureWinStones: 16 },
  },
  {
    id: 'five-captures',
    name: 'Five + Captures',
    tagline: 'You need a five AND a set number of captures.',
    trains: 'Balance: you can\'t win by attacking alone or by capturing alone.',
    rules: [
      'To win you need both: a five in a row and the target number of captured pairs.',
      'The target is 5, 8 or 10 pairs, chosen before the game.',
      'A five counts as soon as you make it, and from then on its stones can\'t be captured.',
      'Neither a five alone nor captures alone will win.',
      'Tournament rule applies.',
    ],
    optionsSpec: { capturePairs: { label: 'Capture target', choices: [5, 8, 10], default: 5 } },
    config: { ...BASE, requireFiveAndCaptures: true, lockBankedFives: true },
  },
  {
    id: 'd-pente',
    name: 'D-Pente',
    tagline: 'One player sets up four stones; the other picks a side.',
    trains: 'Judging a position: who really stands better before the fight starts.',
    rules: [
      'The opener places the first four stones anywhere on the board: two Gold and two Blue, in turn.',
      'The chooser then decides: stay Blue, or take Gold and move next.',
      'After that, it\'s normal Pente: five in a row or five captured pairs wins. There is no tournament rule.',
      'Tip for the opener: set up a position you would be happy to play from either side.',
    ],
    config: { ...BASE, opening: 'free', choice: 'd-pente' },
  },
  {
    id: 'dk-pente',
    name: 'DK-Pente',
    tagline: 'D-Pente\'s opening with Keryo captures.',
    trains: 'Judging a position when threes can be captured too.',
    rules: [
      'The opening is the same as D-Pente: four stones set up by the opener, then the chooser picks a side.',
      'After that, it\'s Keryo-Pente: pairs and threes can be captured, and 15 captured stones win.',
      'Five or more in a row still wins.',
    ],
    config: { ...BASE, captureSizes: [2, 3], captureWinStones: 15, opening: 'free', choice: 'd-pente' },
  },
  {
    id: 'swap2',
    name: 'Swap2',
    tagline: 'A three-stone opening, then a choice of sides.',
    trains: 'Judging a position, and building a set-up that is hard to read.',
    rules: [
      'The opener places three stones in turn: Gold on the centre, then Blue, then Gold, anywhere.',
      'The chooser then picks one of three: play Gold, play Blue, or add two more stones (Blue, then Gold) and let the opener pick a side.',
      'Blue moves next. After that, it\'s normal Pente: five in a row or five captured pairs wins.',
      'Captures made during the opening count for the colour that made them.',
    ],
    config: { ...BASE, opening: 'center', choice: 'swap2' },
  },
  {
    id: 'connect6',
    name: 'Connect6',
    tagline: 'Two stones a turn. Six in a row wins.',
    trains: 'Seeing threats in windows of six, and defending against two stones at once.',
    rules: [
      'Gold places one stone on the centre. From then on each turn is two stones, anywhere.',
      'Win by making six or more in a row: across, down or diagonal.',
      'There are no captures.',
      'With two stones a turn, four in a row is already a threat: two more finish it. Block threats before you build.',
    ],
    config: { ...BASE, captureSizes: [], captureWinStones: null, opening: 'center', lineToWin: 6, twoStones: true },
  },
];

export const COMING_LATER = [
  { name: 'Renju', note: 'Gomoku on a 15×15 board, with limits on the first player.' },
];

export function getVariant(id) {
  return VARIANTS.find((v) => v.id === id) || VARIANTS[0];
}

/**
 * The config the engine plays with, including any options the player picked
 * (e.g. Five + Captures target) and the tournament-rule switch.
 */
export function resolveVariant(id, options = {}) {
  const def = getVariant(id);
  const config = { ...def.config };
  if (def.id === 'five-captures') {
    const pairs = Number(options.capturePairs) || def.optionsSpec.capturePairs.default;
    config.captureWinStones = pairs * 2;
  }
  if (options.tournamentRule === false && config.opening === 'tournament') config.opening = 'center';
  return { id: def.id, name: def.name, options: { ...options }, ...config };
}
