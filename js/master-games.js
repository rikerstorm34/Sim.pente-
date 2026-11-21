// Game records from the 1983 World Pente Championship (Boston), transcribed from the
// U.S. Pente Association booklet "Championship Pente". Only the moves, players and results
// are used (facts); the booklet's commentary is not reproduced.
//
// Moves use the booklet's notation, relative to the centre: "0" is the centre, "R3U2" is
// right 3 then up 2, "L1" is left 1, and "*" marks a capture. White moved first (= Gold here).
// tools/check-1983.mjs replays every game and checks each capture mark against the rules.

const COLS = 'ABCDEFGHJKLMNOPQRST';

/** Booklet notation → board name, e.g. "R1U1" → "L11", "0" → "K10". */
export function toCoord(tok) {
  const t = tok.replace(/[*!?]/g, '');
  let dx = 0, dy = 0;
  if (t !== '0') {
    for (const [, d, n] of t.matchAll(/([RLUD])(\d+)/g)) {
      const k = Number(n);
      if (d === 'R') dx += k; else if (d === 'L') dx -= k; else if (d === 'U') dy += k; else dy -= k;
    }
  }
  return COLS[9 + dx] + (10 + dy);
}

// winner: 'W' (first player) or 'B'. Opening names from the booklet's openings index.
export const GAMES_1983 = [
  { n: 7, white: 'Dave Wallace', black: 'Bill Webber', winner: 'W',
    moves: '0 R1U1 U3 R1U3 R2 R1U2 R1 L1 R2U2 U1 R2U3 R1U5 R1U4 U5 R3U2 R4U2* R3U2 R2U5 R3 R4 R4U1 L1U2* R1U4' },
  { n: 8, white: 'Bill Webber', black: 'Dave Wallace', winner: 'B',
    moves: '0 D1 R3 R2D3 R1D2 D3 R1 R2 R1D1 R1D3 R3D3 L1* R1 L1D3 L2D3 L1D2 L1U1 L2D1 R2D2 0 L2* 0 R1D4 D2 L2D4* D2 L2D2* D2' },
  { n: 9, white: 'John Hawkins', black: 'Bill Justice', winner: 'W',
    moves: '0 L1 D3 L1D2 L1D1 L2D2 D2 R1U1* L3D2* D1 R1D2 D4* L2U1* D1 L1D4 D3 D2 L2D3 L1D2 L2D2 L1D3 L1D1 0 R1D1 L3D3* L2D4* D2 L2D2 R3D2 R2D2 R3D3*' },
  { n: 10, white: 'Bill Justice', black: 'John Hawkins', winner: 'B',
    moves: '0 R1D1 D3 R1D3 R1D2 R2D1 D1 L1D4* U1 D2 R2D4 L1D3 R3D1* L1D1 U2 U3 L2D4 R1D1 L1D2 R1 L1D5* L2D3* R1D2 R1U1 D6 L3D3 R1D5 L1D3 D3 R3U1 R2 R4D2* R2 L1D7 R1D7 R2D8 D5 R2D5 D8 D4 L2D2* L1D3' },
  { n: 11, white: 'Hai-Chou Chen', black: 'Brad Beatty', winner: 'W',
    moves: '0 R1U1 U3 R3U1 R2U1 R3D1 U2 U4 U1 D1 R4U3 R3 R3U2 R5U4 R2D1 R3D2 R3D3 R1U3 R2U2 R1U2 L1U5* U5 R2 R4U2* R3U2 R2D2 R2U3 R2U2 R3U3*' },
  { n: 12, white: 'Brad Beatty', black: 'Hai-Chou Chen', winner: 'B',
    moves: '0 L1 R4 L1D2 L2U2 R1D1 R2 R3 R2D2 L1U1 L1D1 R1U1 R2D1 R2U1 R2D3 R2D4 U1 R1 R3U1* R2U1 D1 L2D1* D1 L1D1',
    note: 'Move 9 is printed as L1, a point already taken; U1 is the only point that fits the rest of the record.' },
  { n: 13, white: 'Grady Johnston', black: 'Brent Rustad', winner: 'W',
    moves: '0 R2U2 L4 L2 L2U2 L1U1 U2 L3D1 L1U2 L3U2 L3U1 L5D1 U4 L1U3 U1 U3 L2U3 L4D2 L5D3 L3U4 L2U5 L2U6 L2U4 L2U1 L2D1* L2U1 R1 R2D1 L1 L3D2 R2' },
  { n: 14, white: 'Brent Rustad', black: 'Grady Johnston', winner: 'B', doubtful: 'Move 5 for Black is printed on a point already taken, and the record can\'t be repaired with confidence.',
    moves: '0 R3U1 R3 R1U3 U2 L1U3 R2U2 U3 R2U3 R2U2 R2U4 R1U1 U1 R1U2 R1 R5U1 R4U1 R2D1 R5 R5U2* R4U1 L1U4' },
  { n: 15, white: 'Ken Krenz', black: 'Peter Hudson', winner: 'B',
    moves: '0 R3U2 L4 R1 L2D2 R2U1 R4U3 R1U2 R3 U3 L4D2 R2U2 U2 R2U3 R2U4 L1U4 L2U5 R2D1 R2 R4*' },
  { n: 16, white: 'Peter Hudson', black: 'Ken Krenz', winner: 'W',
    moves: '0 L1U1 L3 L3U1 L2U1 L1D1 L1U2 L4D1 U3 R1U4 U2 U1 R1U1* U1 L2U2 U4* U2 R1U2 L4U2 L3U2 L3U3* L3U2 L1U1 L3U1* L1U1 R2U2* 0' },
  { n: 17, white: 'Alfonso Ruiz', black: 'Robert Argleben', winner: 'W',
    moves: '0 L2 U4 D2 L2U2 R2 L1U3 L3U1 L1D1 R1D1 R1U5 R2U6 L4U2* L3U1 L1D3 L2D2 L1U2 R3U1 R4U2 L3U2 L1U1 L1 L3U3 U2* L2U2 L4U4' },
  { n: 18, white: 'Robert Argleben', black: 'Alfonso Ruiz', winner: 'B',
    moves: '0 R1U1 R4 L1U1 R2 U1 R3 R1 L1U2 R2D1 R1U2 R1D1 U2 L2U1 L3U1 R2U1' },
  { n: 19, white: 'Marvin Cooper', black: 'Brian Silberberg', winner: 'W',
    moves: '0 L1D1 L3D2 R1D1 L2 D1 L2D1 R2D1 R3D1 L1 L2U1 L4D3* L2D1 L2D2 L3D3* L2D2 R1D2* L1 D1* R2D3* D2 D3 D1 U2 R3D3 R2D1 R3D2 R3 R1D2 R4D4 R4U1*' },
  { n: 20, white: 'Brian Silberberg', black: 'Marvin Cooper', winner: 'B',
    moves: '0 R1U1 R3 R3U1 U2 R2U1 U1 D1 R1 R5U1 R4U1 R2D1 L1 L1U2* R1 R5U2* R4U1 U1 L2U3* U1 L1U1 L1U2 R1D1 L1D1* L1U1 R1D2* R1D1 R1 L2D1* R3D2' },
  { n: 21, white: 'Peter Hudson', black: 'Dan Allen', winner: 'W',
    moves: '0 L1D1 L3 L1U1 L1U2 L4D1 R1U2 R2U2 U2 L3U2 U1 D1 U3 U4 L2U1 R1U4 L2D1 R2U3 L1 L3D2 L2' },
  { n: 22, white: 'Dan Allen', black: 'Peter Hudson', winner: 'W',
    moves: '0 L3D1 L3 L1D1 L2D1 L4U1 L1D2 L1U1 D3 R1D4 D2 U1 D4 D1 R1D1* D1 L2U1 L2 L4D2 L2D2 L1U2 R1U3 R1U1* L1U1 U2 L4D1 L5D1* L4D1 R2U2 R2 R1U2 L1U3* U2 R3U2 L2U2' },
  { n: 23, white: 'Grady Johnston', black: 'Alfonso Ruiz', winner: 'W',
    moves: '0 L1D1 L4 R1D1 L2 D1 L1 L3 R1 R2 R3U1 L3D2 D2* R2 L3D1 R1D1 R2D1 L1U1 L2D2 L5U1 R3D2 U1 R1D2 R2D2 R3D3*' },
  { n: 24, white: 'Alfonso Ruiz', black: 'Grady Johnston', winner: 'B',
    moves: '0 L1D4 U4 L1D2 L2U2 L1D3 L1D1 L1D5 L1D6 L2D2 L3D1 D4 L1U3 L3U1 R1U5 R2U6 L2D1 R1U1* L1D1 D1 L4D1 L5D1 R1 R1D5 R2D6 D5 L2D3* D1 R1D6* L2D7 R1D3 L3D7 L4D8 D2 0 D3 D5 L1D4 R1D1 R2D7* L2D4* D2 R1D4* R1D2* L2D5 R2D2' },
  { n: 25, white: 'Marvin Cooper', black: 'Hai-Chou Chen', winner: 'W',
    moves: '0 L1 L2D3 L1U2 L2D2 L1D1 L1U1 L2D1 R1D1 R2D2 L3U3 L2U2 U2 R1U3 L3U2* L2* L1U1 L2U2 L2U1* L4U3* L2D1 L2 L3* L2 L3U1 L1D2 L3U2 L4U1* L3' },
  { n: 26, white: 'Hai-Chou Chen', black: 'Marvin Cooper', winner: 'W',
    moves: '0 L1D1 D3 L1D3 L2D5 L1D2 L1D4 R1D2 L2D2 L1 L1U1 D1 L2U1 R1D1 L3D6 L4D7 L2D1 L2U2* L1U1 L2D3 R1 L2* L3U1 L4U1 R1D3* R2D3* R1D2* D3 R1D3 L3D3 L4D3 R1D1 R1D4 D2 D4 R2 L2D2* D2 D1* D3 D2*' },
  { n: 27, white: 'Dave Wallace', black: 'John Krenz', winner: 'B',
    moves: '0 L1U1 U3 L1D1 L2U1 L1D3 L1U2 L3 L1 D1 R1 L3U2* L1 R2 R1U4 R2U5 U1 U2* U1 R2D1 L2D1 R1D1 R3D1 D2' },
  { n: 28, white: 'John Krenz', black: 'Dave Wallace', winner: 'B',
    moves: '0 U1 R4 R2U3 R2U2 R1U2 L1 R1 L2 L1U2 L2U3 R1U1 R1U3 R3U4 R4U5 R1D1 R1D2 R3U1 R2U1 R2* R3* R1 R2U1 R4D1* R2U1 U2 U3* L1U3* R1U3 U2' },
  { n: 29, white: 'Rollie Tesh', black: 'David Comberrel', winner: 'W',
    moves: '0 L1U3 D3 L1U1 D1 D2 U1 R1U3 U2 U3 L2U3 R1 L1U2 R1U2 L1U4 R1U1 R2U1* U3 L3U4 L4U5 R1U2 R3* R1U2 R2U3 R3U3 L1* R1U2 L2U2 U5 L3U2 L4U2* L3U2 R1D1* R2U2 U1 R1 L1D1*' },
  { n: 30, white: 'David Comberrel', black: 'Rollie Tesh', winner: 'B',
    moves: '0 R1U1 U3 R1U3 R1U2 R2U1 U1 L1U4* R3U1* U2 L1U1 D1* R2U4* R2U1 R1D1 R1 L1D2 R4U3 R3U2 R3U3 R1U2 R5U3 R2U3 R1U4 R4U1 R5U1* R4U1 R5 R5D1 R5U2 R5U4 R7U5 R6U3 U1 R2U5 R3U4* R2U3 R7U2 R4U5 R7 R3U5* R7U1' },
  { n: 31, white: 'Bill Justice', black: 'Robert Colbert', winner: 'W',
    note: 'Move 3 for White is printed as L2D2; L2 is the only point that fits the capture marks that follow.',
    moves: '0 L1D1 D3 L3U1 L2 L3D1 D1 U1 D2 D4 L3 L1 L2D1 L4* R1U2* U1 L2D2 L3 L5U1* L3U2 L3U3 L3D2 L3D1 L4D1* L3D1 L4 L5 L2 L5D1 L1D3* L2U2* L3U1 L3D1' },
  { n: 32, white: 'Robert Colbert', black: 'Bill Justice', winner: 'W',
    moves: '0 L1 D4 R1D1 D2 D3 L2D2 R1D3 R2D3 L1D3 D1 L1D1 U2 U1 R1U2 L2D3 L3D3 L4D4* L3D3 L2D1 L3D1* L2D1 L3D2 L3 L4U1 R1D2 L1D4 R1D4 R2D1* D3 L1D2* R1* R1D2 R3* R1D2 L3 L2D1*' },
  { n: 33, white: 'John Hawkins', black: 'Brian Silberberg', winner: 'W',
    moves: '0 R1U1 R3 R3U1 R2U1 R1U2 R1 R4D1* R1U3* L1 R2 R2D1 R1U1 R1U2 R3D1 R1D1* R1U1 U2 L1D1 R2U2 R4* R2U2 L1U2 R5 R5D3 R4D2 R4D3* R4D2 R6D3 R7D3 R5U1 R3U2 R4U2 R6 R3U3 R6U2 R1D3 R2D2 R3D3*' },
  { n: 34, white: 'Brian Silberberg', black: 'John Hawkins', winner: 'B', uncertain: true,
    note: 'Black\'s moves 7 and 8 are both printed as R2U3; one of them must be R2U2. This replay uses R2U2 at move 8.',
    moves: '0 R1D1 L3 R1U1 U2 R1 R1U2 L1U2 U1 R1D2 R1D3 L1 D1 R2U3* R1U2 R2U2* R3U3* R1U2 R1U1 U1' },
  { n: 35, white: 'Bill Webber', black: 'Robert Argleben', winner: 'W',
    moves: '0 D2 D4 L2D2 R2D2 L1D1 R1D3 R3D1 R2D6 R1U1 R1D5 R3D7 R1D4 L1D4 L1D5 L2D6 D5 R2D5 R1D1 R2D4* D4 R3D3 R4D2* R3D3 R3D2 R5D2 L2D5 L3D5 L1D7 D6 D3 L4D4 L1D3 L2D3 L3D2* L2D3 R1D2 R1D4 R3D6*' },
  { n: 36, white: 'Robert Argleben', black: 'Bill Webber', winner: 'B',
    moves: '0 R1U1 U3 R1U3 R2U5 R1U2 R1U4 L1U2 R3U6 R4U7 U2 R1 R1D1 U1 R2D1 L1 L1U1 L2D2 R2U1* U1 R1U1* L3D2' },
  { n: 37, white: 'Brent Rustad', black: 'Brad Beatty', winner: 'B',
    moves: '0 L1D1 L3 L1U1 L1D2 L4U1 L3U1 L3D1 L3U2 L2D1 L4D1 D1 R1D1 R2D2* R1D1 L5D2 L2U1 L5D3 L1U2 U3 L3U4 L3U3 L4U3 L4D2 L2' },
  { n: 38, white: 'Brad Beatty', black: 'Brent Rustad', winner: 'B',
    moves: '0 R3U1 R3 R1U1 U2 R1D1 U1 D1 U3 U4 R2D1 R2 L1D1* L2D2* R3D1* R3D2* L2U3 R2U2 R1U3 L1U3 L1U2 R1 L2U2 L2U1 R1U5* R1U4* R2U4 0 R3U5 U3* R4U6 L2U4*' },
  { n: 39, white: 'Ken Krenz', black: 'George Rittersbach', winner: 'B',
    moves: '0 R1U1 L4 R3U1 U2 R1D1 D2 R1 R1U2 R1D2 R1D3 L1U2 U1 R2U2* R3U3* R1U1 R1U2 L1 D1 R2U3* R1U2 U1 L2D1* U1 D3 D4 R2U1 L2U3 L1U1* U1' },
  { n: 40, white: 'George Rittersbach', black: 'Ken Krenz', winner: 'W',
    moves: '0 R1U1 R3 R3U1 U2 R1D1 U1 U3 D2 D1 R2D1 R1D2 R1 R4U1* R5U1 R2D1 R1D3* L1D1 L2D1 R1D1 R3D1 R2D4* R4 R6U2 R1D3 R2D2 R3D3* R2D2 R2D3 D3 R2* R4D2* R3D1 R2D2 R4D3 R5D3 R6D4* R5D3 R2U1*' },
  { n: 41, white: 'Dan Allen', black: 'Grady Johnston', winner: 'W', doubtful: 'Black\'s moves 6 and 7 are both printed as R1, and the missing move can\'t be worked out.',
    moves: '0 D1 R3 R2D3 R1D2 R3D1 R3D2 R2D2 R2 R2D4 R2D5 R1 U1 R1 R4 L1D2 R5 R6 R2U1 L2D3 L3D4 R2D1 R2U2 R4D1 R1U2 R2U3 U3 L1* R1U2 L1U4 U1* R1 U2 U4 R4U2 R3U2 R1U4 L1U2 L2U4* R2U5* U3 U4' },
  { n: 42, white: 'Grady Johnston', black: 'Dan Allen', winner: 'B',
    moves: '0 L4D1 L4 L2D3 L2 L3D2 L1 L3 L5D2 L3D1 L2U1* L3 L3D3 L4D1 L5 L5D1 L6D1 L3U2 L3U1 L2U2* L3U1 L4U2 L1U2 L1D1*' },
  { n: 43, white: 'Rollie Tesh', black: 'Peter Hudson', winner: 'W', doubtful: 'Move 15 for White (printed L6D3*) can\'t be squared with the capture marks that follow.',
    moves: '0 L3D2 L3 L1D4 L2U2 L2D3 L4D1 L2U1 L5D2 L2D1 L1 D5 R1D6 L2 L4D3* L2D1 L2D2 L3D4 L1D1 R1* L4D4 L1D2 D3* L1D2 D1 L4D5 L5D6 0 L6D3* L6D1* L5D2 L7D4 L2D1* L4U1* L3D1 L3D3* L1D1 L2D1 L3*' },
  { n: 44, white: 'Peter Hudson', black: 'Rollie Tesh', winner: 'B',
    note: 'Hudson lost on time.',
    moves: '0 R1U1 R3 L1 R2 R4 R1U2 R2U1 R3U1 R1* R1D1* R2D2 R2 L1U1* R1D1 D2 R4U2 R5U3 R3U2 R5U2 R3U3 R2U2* R3U2 R3 R5* R3 R4D1* R3 R6U1 R3D2 R7U2 R8U3 R1D2 R4D2 R3U4 R3U5 R6D2 R4U4' },
  { n: 45, white: 'Marvin Cooper', black: 'John Hawkins', winner: 'W',
    moves: '0 R1D1 R4 R1U1 R2 R1 R1U2 R1D2 R1D3 R3 R4U2 R2D1 R4U1 R4D1 R4U3 R4U4 R3D1 R4D2* R4D3* R4D1 R3D1 R5U1 R2D2 D4 D1* R1D1 R5D2 R3D4 R2U1* R4D1 U3 L1U4 U1 U2 D3 D2 L1D2* L2D3* D1 D2' },
  { n: 46, white: 'John Hawkins', black: 'Marvin Cooper', winner: 'W',
    moves: '0 L1D1 L3 L3D1 L2D1 L1D2 L1 L4U1* L1D3* L2 L1U1 L1D1 R1D1 L1U2* D2 R2 L3U1* L1U1 D1 R2D2* 0 D3 L2 L1D1 U1 U2 R1U3* U2 L2D4 L3D5 L2U2 R1U1 L1U3 L4U2* U4 L3U1 R1U5 R2U6 L2 R3D1 R4D2 L5U3 L1U5' },
  { n: 47, white: 'Dave Wallace', black: 'Hai-Chou Chen', winner: 'W',
    moves: '0 L1 U3 L1D2 L2U2 R1D1 L1U1 L3U3 R2U1 R1U1 R1U2 L1U4 U2 U4 L1U2 L1U3* L1U2' },
  { n: 48, white: 'Hai-Chou Chen', black: 'Dave Wallace', winner: 'B',
    moves: '0 U1 L3 L2U3 L3U2 L1U2 L3U4 R2D1 R1 L1 L3U1 L3U3 L4U3 L1U3 L1U1 R1U2 L2D1 R3U4 R2U3 U3 L1U4* L1U3 R2U1* U3 R1U3 R3U3* R1U3 R1U2 R2U3 R3U5 R3U2 R3U6 R3U7 R4U1' },
  { n: 49, white: 'Robert Colbert', black: 'John Krenz', winner: 'W',
    moves: '0 L1U1 L3 L3U1 L2U1 L4D1 L1U2 L1D1 U2 R1U2 L2U2 D1 U3 R1U4 U4 U1 R1U1* U1 L4U2 L3U2 L3U3* L3U2 L1U1 L3U1* L1U1' },
  { n: 50, white: 'John Krenz', black: 'Robert Colbert', winner: 'W',
    moves: '0 L1D1 L3 R1D3 L1D2 D3 R2D3 L1D3 L2D1 R1D1 L2 L4 L1 R1 R1D2 R2U1 R1U1* R1 L2U1 D1 L2U2 L3U2* L2U1 L1* L2 L3* L2D1' },
  { n: 51, white: 'Bill Webber', black: 'Bill Justice', winner: 'W',
    moves: '0 L1 L4 R1D1 L2D2 L1D1 L1D2 D2 L1U1* L1D3 L2D4 R3D1 L2D3 L3D2* L2D2 L2D1 L2D5 L2D6 L1 L2U2* L4D3* L2D1 L3 L5 0 L2* L2U1* L2D1 L2 L3 R2 R1 R1D2 R1U1 L3U2 D1 D3*' },
  { n: 52, white: 'Bill Justice', black: 'Bill Webber', winner: 'B',
    moves: '0 R1U1 U3 R1U3 R1U2 R2U1 U1 L1U4* D1 U2 R2U4 L1U1 R3U1* L1U3 D2 D3 L1U2 L2U4 L1U5* L1U3 R1U1 R2U1* R1U1 L1D1 R2U2 R4* R2U2 R3U3 R2U3 L1 U3 R2U5 L2U1 L3 L1D2 L3D1 L2 L3D2 L3D3 L3U2 L3U1 L4U2*' },
  { n: 53, white: 'George Rittersbach', black: 'Alfonso Ruiz', winner: 'W',
    moves: '0 L1D1 D3 L3U1 L2D3 L2 D2 L4U2 L5U3 D1 L2D1 D4* R1D1* L1U1 U2 R2D2* L3D1* R1D3 R3D1 L1D1 L2* L4D1* L2U2 L1D5 L2D6 L1D3 L2D2 L2D1 R1D5* D4 L3D1 D1 L1U1' },
  { n: 54, white: 'Alfonso Ruiz', black: 'George Rittersbach', winner: 'B', doubtful: 'Several moves from move 7 on contradict the capture marks; the record looks garbled.',
    moves: '0 R1U1 U3 L1U1 U1 U2 R1U2 D1* L1U3 R2U3 L2U3 L3U3 L2* L1U1 L2U2 U4 L3U1 U1 R2U1 L2U4* L2U2 U4 L4 L5D1 L4U2 L5U3 L3 L3U2 L3U4* L3U2 L2U3 L3U3 L4U5 L3D1* L3U1* L2U4* L2U3 L2U2*' },
  { n: 55, white: 'David Comberrel', black: 'Brad Beatty', winner: 'W',
    moves: '0 L1D1 D3 L1D3 L1D2 D2 L2 L2D4 R1D3* D2 R1D1 L3D5 L4D6 R2D2 R1D2 L1U1* R1D1 R2D3* R1D3 R1D4 R1 R1U1 L1 R2 0 L3 R3D1 U2 R2D1 R4D1 R3D2 D3 R3' },
  { n: 56, white: 'Brad Beatty', black: 'David Comberrel', winner: 'B',
    moves: '0 R1D3 U3 R1D1 U1 U2 D1 L1D3 D2 D3 L2D3 R1D2 R2D1 R1 L1D4* D3 R1U1 R1D2 R1D4 R3D3 R2D3 D5 R2U1 R3D2*' },
  { n: 57, white: 'Brian Silberberg', black: 'Brent Rustad', winner: 'W',
    moves: '0 R3U1 R3 R1U1 R2U1 R1D1 R4D1 R5D2 U3 R1U2 R1 R2 R1U3* R1U2 R4U2 R2U3 U1 L1U3* U3 D1 U2 U4 R3U4* R1U2 R2D1 L1* R1D2 D2 L1D1* R1D1 L1D3 D3 R5U2 R4U1 R5U1* R4U1 0' },
  { n: 58, white: 'Brent Rustad', black: 'Brian Silberberg', winner: 'B',
    moves: '0 R3U1 R3 R1U1 R1D2 R2U1 R4U1 R2D1 U1 R5U2* D1 R4U1 R5U1 R3 R6U3 R2D3 L1 R2 R2D2 R1U2 U2 L2D1* U1 L1* R1D2 U3' },
  { n: 59, white: 'Robert Argleben', black: 'Ken Krenz', winner: 'W',
    moves: '0 L1U1 D4 L1U3 U2 L3U3 U1 U3 D1 D2 L2U3 R1U3 L1U2 R1 L2U2 R1U2 L3U2 L4U2 L4U5 L3U4 L3U5* L3U4 L1U4 R2U1 R4U1' },
  { n: 60, white: 'Ken Krenz', black: 'Robert Argleben', winner: 'W',
    moves: '0 R1U1 U4 R1D1 U2 R1 R1U2 R1D2 R1D3 L1U2 R2U2 U1 R2D1 L1U1 R3U2 R4U2 L2U1 L1U3 L1 R3U1 R2U1 R4U3* R2U1 R3 U3 R2 R3D1* R2 R3U2* R2U3* U5 U6 R3* R4U1* R1U1* R2* R1*' },
  { n: 61, white: 'Dan Allen', black: 'Dave Wallace', winner: 'B',
    moves: '0 D1 R3 R2D3 R1D2 D3 R1U2 R1D3 L1D3 R4D1 R1 R2 R3D1 L1* R3U2 R3D2 R3U1 R3U3 R1D4 R4D3 R3D3 R2D1 R1 R2U1 R2D2 D2* R2D2 0 L2*' },
  { n: 62, white: 'Dave Wallace', black: 'Dan Allen', winner: 'W',
    moves: '0 R4U1 U3 R2U3 L1U4 R3U2 R1U4 R2U5 L1U2 R5 R6D1 R1U2 U1 L2U5* D1 U2 R2U2* U2 R1U1 L1D1 L1U1 L2U1 L1U3 L1U4 L2U3 R1 L3U3 L4U3 L2U2 L2U4* L2U2 L3U2* L2U2' },
  { n: 63, white: 'Rollie Tesh', black: 'Marvin Cooper', winner: 'W',
    moves: '0 L1D1 L3 L3D1 L2D1 L1D2 L1 L4U1* L1D3* L2 L1U1 L1D1 R1D1 L1U2* L1U1 R2D2 D2 R2 L3U1* R2D1 R2U1 L2U2 L2D4 L3D5 U1' },
  { n: 64, white: 'Marvin Cooper', black: 'Rollie Tesh', winner: 'B',
    moves: '0 R1U1 R3U2 R3U1 D1 U1 R2U1 D2* R1 D1 R4U3 R5U4 0 L1U1 D3* D1 R2 R2D1 R2U2 L2U1 L3U1 L1 R3 R4 R5D1* R4 L3U2 L1D1 L2D1 R1D1 R3D1 R4D2* R3D1 R4D1 R3D2 R1U2*' },
  { n: 65, white: 'Grady Johnston', black: 'John Hawkins', winner: 'W',
    moves: '0 L1U1 L3 L3U1 L2U1 L1U2 L1 L4D1* R1 L2 R2 R3 U2 L4U2 L3D1* L2 L1D1 L5U3 L6U4 R1U1 L1D2 L2D2* L1D1 L1D3 D4* L1D3 L2D1 L3D2 U1 R2D1* U1 U3 D1 R1D1 L2D3 0* L5* L4D1 L3D4' },
  { n: 66, white: 'John Hawkins', black: 'Grady Johnston', winner: 'W',
    moves: '0 L1 U3 L3U2 L2U1 L1U2 L2U3 L1U1 L1U3 R1U3 L1D1 R1U1 L2 L2D1 L2U2 L2U4 U1 U4 L3D2* L3U1* L2D1 D2* L2 L2U2 L3U3* L2U2 L1U3 L4U3 L4* L2U2 L5U4* L4U3 L1' },
  { n: 67, white: 'Bill Webber', black: 'George Rittersbach', winner: 'W', doubtful: 'Black\'s 11th move is missing from the record.',
    moves: '0 L1D1 D3 R1D1 R2D1 L1D4 R1D2 L3D1 R3 R4U1 D1 D2 R2 U1* R4 R1 R5 R6 L1U2* R1 R1U1* R9U9 U2 L1U3 R2U1 R2U2 R2D3 R2D2 R4D2' },
  { n: 68, white: 'George Rittersbach', black: 'Bill Webber', winner: 'B',
    moves: '0 R1U1 U3 R1U3 R2 R1U2 R1 L1 L1U1 L2U2 R2D2 R1D1* R3 R4 U1 L1U2 U2 R2D1* R1 R1U5 R1U4 R2U5* R1U4 D1 L1D1 R4D1' },
  { n: 69, white: 'Peter Hudson', black: 'John Krenz', winner: 'W',
    moves: '0 L1U1 L3 L3U1 L2U1 L1U2 L1 L4D1* L1U3* L2 L1D1 R1* L4U2* L1U2 U1 R1U2 L3U1 L2 L2U2 L5U3* U4 L3U1 L4U2* L3U1 R2U2 R1U1 R1U3 R3U1 L1U5 L2U6 L3U3 R1D2 R1D1 U2 L2U4 L3U5* L2U4' },
  { n: 70, white: 'John Krenz', black: 'Peter Hudson', winner: 'B',
    moves: '0 L3D2 L3 L1D4 L2U2 L2D3 L4D1 D5 R1D6 L5D2 L2U1 L2 U3 L2U3* L2U1 L1U2 U1 U2 L3U4* L1U2 R1U2 D1* L2U2* L1U2 L2U5 R2U1 R1 L1U4* L3U2 L2U3* L2U1 L4U3' },
  { n: 71, white: 'David Comberrel', black: 'Robert Colbert', winner: 'W',
    moves: '0 R1U1 R3 R3U1 R2U1 R1U2 R1 R4D1* R1U3* L1 R2 R3 R3U2 R2U1 R3D1* R3 R1U2 R1U1 R2U2 R1U4* R1U2 U2 L1U3* U2 R1U1 R5D2 R6D3' },
  { n: 72, white: 'Robert Colbert', black: 'David Comberrel', winner: 'W',
    moves: '0 R1D3 D3 R1D1 R1D2 R2D1 D1 L1D4* R3D1* R1D1 U1 U2 R2 R1 D3 D2 L1D3* L2D3* R1D1 L1D1 R2D1 R4D1 D2 D3 L1D3' },
  { n: 73, white: 'Hai-Chou Chen', black: 'Brian Silberberg', winner: 'B',
    note: 'Black\'s last move is printed on a point already taken, so it is left out; White resigned after it.',
    moves: '0 L3D1 L3 L1D1 D2 L2D1 D1 U1 L1 L5D1 L4D1 L2U1 R1 L5D2* L4D1 R1D2* L1 D1 R2D3* D1 R1D1 L1U1 R1U1 L3U1 L4U1 R2U2* R1U1 R1D2 R2 U2 R3D1 L2 R3' },
  { n: 78, white: 'Ken Krenz', black: 'Brad Beatty', winner: 'W',
    moves: '0 R1U1 R3 R3U1 R2U1 R4D1 R1U2 R2 U3 L1U4 U2 U4 U1 D1 L1U2 R2U2 L2U3 L3U2 R3U3* R2U2 R1U3 R2U4 R2U3 L1U1*' },
  { n: 79, white: 'Brent Rustad', black: 'Robert Argleben', winner: 'W',
    moves: '0 L3D1 L3 L5D1 L1D2 L4D1 L2D1 L6D1 L7D1 D3 L1 U1 L3D2 L2 L4D3 L5D4 L1U2 L1U1 L4D2 L4D4* L4D2 L6D4 L7D4 L7D2 L8D3 L2D2 L6D5 L5D6 L5* L3D4 L2D4 L5D2* L4U1 L3D2* L2D1 L5U2 L4D2* L5D3 L5D5 L4D5 L6D3* L7D5* L5D2 L4D1 L5D5*' },
  { n: 80, white: 'Robert Argleben', black: 'Brent Rustad', winner: 'W',
    moves: '0 R3U2 R4 R3 R2D2 R1 R1D1 R3D3 R3D1 R1D3 R2D1 R4D1 D1 L1D1 D2 D3 R2D3 R2 L1D3* U1 R5U1' },
  { n: 81, white: 'Dave Wallace', black: 'Rollie Tesh', winner: 'B',
    moves: '0 R1U1 U3 R1U3 R2 R1U2 R1 L1 R2U2 L1U2 R2U3 R1U5 R1U4 R2U5* R1U4 U5' },
  { n: 82, white: 'Rollie Tesh', black: 'Dave Wallace', winner: 'B',
    moves: '0 U1 L3 L2U3 L1U2 U3 L1 L2 L1U3 L1U1 L3D1 U2 L3U1 L3U2 L4U1 U5 U4 L1U4* R1U6 R1U3' },
  { n: 83, white: 'Dan Allen', black: 'Bill Webber', winner: 'B',
    moves: '0 R1U1 R3 R3U1 R2U1 R1U2 R1 R4D1* R1U3* R2 R1D1 L1* R4U2* R2 L1U1 0 R1 L2 R1U1 R1U2 L2D1 R1D2 U1 R2D1 R2U1 L1U2* R1 D1 L2U1 R3U2* R1 R2U2 U2 L1U3*' },
  { n: 84, white: 'Bill Webber', black: 'Dan Allen', winner: 'W', doubtful: 'Move 11 (D2*) is marked as a capture, but no capture is possible there; the record can\'t be repaired with confidence.',
    moves: '0 L4D1 R3 L2D1 R1U1 L1D1 L3D1 D1 R2U2 R1D1 R2D1 R1D2 L1 R4U1* R2D3* D1 R2D1 R1D2 R3U1 L2 D2* R1* R2 R2U1 R1D1 R3D1* R1D1 U2* R2' },
  { n: 85, white: 'John Hawkins', black: 'Peter Hudson', winner: 'W',
    moves: '0 L2 L4 L2U2 L2U1 D2 L1D1 L2D2 R1U1 U2 R1U3 R2U2 R1U2 R1 L1U2 R1U4 L4D1 U3 R2U5* U3 L3 L5* L3 L5D2 R1U5 R1U4 L1U5 L2U5 R3U5 U5 L1U6 R2U3 L1U4 L1U3 L2U3* L3U2* U3' },
  { n: 86, white: 'Peter Hudson', black: 'John Hawkins', winner: 'B',
    note: 'Black won by reaching five captures.',
    moves: '0 R1U1 R3 R3U1 R2U1 R1U2 R1 R4D1* R1U3* R2 R1D1 L1* R4U2* R1U2 U1 L1U2 R3U1 R2 R2U2 U4 L1U3 U3 R4 R5D1 R3D1 0 R6D1* R5D1 L2 R1 R3 R5* R3 R5U3* R3U1 R5U1 R5U2 R5D3 R5D2 R4D3 R7 R3D3 R2D3 R7D3 R6D3 R7D4 R4D1 R2D1*' },
  { n: 87, white: 'Bill Justice', black: 'Grady Johnston', winner: 'B',
    moves: '0 L1D4 L4 L1D2 L2D2 L1D3 L1D1 L3D3 L4D2 L2D3 L4D3 D3 R1D3 L4D1 R1U1 R2U2 L3D2 R1D4 L2D1 L2* L2D1 L4D4* L4D3 L1 D1 R1D1 L3D4* L2D5 L2D3* L5D2* L3* L1D2 D2 L4U1* L2D1 L4D3 L5D3* L4D3' },
  { n: 88, white: 'Grady Johnston', black: 'Bill Justice', winner: 'B',
    moves: '0 L1 L3 R1 L1D2 R1U2 L2D1 D3 R1D1 L1U1 L4U1 L5U2 L1U2 R2D2* L2U1 L4D1 L1D1* L1 L3U1 L5U1 L3D1 L3U2 L3D3 L3D2 L5 L6D1* L5 L2D3 L1D3 L1D4 D5 R1D1 R1U1 0 R1D2* R1D1 R3D3 L1U1 L2U2 L4U1* L3U1 L1U3 L6U3*' },
  { n: 89, white: 'Robert Colbert', black: 'Marvin Cooper', winner: 'W',
    moves: '0 L1D1 L3 L3D1 L2D1 L1D2 L1 L4U1* L1D3* L2 L1U1 L1D1 R1D1 L1U2* L1U1 L2U2 D2 R2 D4 L3U2 D3 D1 L2D1* D1 R3D3 R2D2 R2D3' },
  { n: 90, white: 'Marvin Cooper', black: 'Robert Colbert', winner: 'W',
    moves: '0 L3D1 L3D2 L5D1 L1 L2 L4D2 R1* L1U1* L5D2 L5D3 L2D2* L5* L2 L3U1 L5U1 L2U1 U1 L1U2 L1 R2D1* L1U3* U1 L1U1 L1U2 R1 L1D1* L1U1 L3D1 U2 L2U4 R1U1 R1D1' },
  { n: 91, white: 'David Comberrel', black: 'George Rittersbach', winner: 'W',
    moves: '0 L1D1 D3 R1D1 R2D1 L1D4 R2D3 L1D3 L1D2 D2 R2 L2D4 L3D5 R2D2 R3D3* R2D2 R1D3 R4D3 L1D5* L1D3 R1D4 R2D5 D5 L2D5 R1D5' },
  { n: 92, white: 'George Rittersbach', black: 'David Comberrel', winner: 'B',
    moves: '0 R1D3 D3 R1D1 R2 R1D2 R1 L1 R2D1 R3D2 U1 D1 L1D1* D1 R2D3 R2D2 R4D2 R3D1 R4 R3 L1U2 L2U3 R3U1 R3D4' },
  { n: 95, white: 'Brian Silberberg', black: 'Ken Krenz', winner: 'W',
    moves: '0 L1D1 L3 L3D1 L2D1 L1D2 L1 L4U1* L1D3* L1D1 R1 R2 L2 L3 L2D1 L3D2 L5U2* L3 L3D3 L3U2 L3U1 L4U2* L2U2* U1* L2D3 L4D3 D3 R1D3 L2D1 L2 L5D4* L4D3 L3U1' },
  { n: 96, white: 'Ken Krenz', black: 'Brian Silberberg', winner: 'B',
    note: 'White\'s move 14 reads R4D1*, a point already taken; R4U1* is the only point that fits.',
    moves: '0 R1U1 R4 R1D1 R1D2 R3U1 R2 R3 R3U2 R3D1 R2U1 R3D2 R3D3 R1 R4U3 R1U3 R1U2 U3* R1U2 R2U3 L1U3 R4D1 R5D1 R6D2* R5D1 R2D1 R4U1* R2D1 R3* D1 R3D1 R3D2* R3D1 R4D2* R3D1 R5*' },
  { n: 97, white: 'Brad Beatty', black: 'Robert Argleben', winner: 'B',
    moves: '0 R3U1 R3 R1U1 R2U1 R4D1 R1 R2 D1 L1* R1 R1U2* R2U1 L1D2 R1U3* L1D1 L1U1 R1D1 R4U3 R3U2 R3U3 L1D3' },
  { n: 98, white: 'Robert Argleben', black: 'Brad Beatty', winner: 'W',
    moves: '0 L1D1 D3 R1D1 R2D1 L1D4 R1D2 L1D2 R3 R3U1 L1D3 L2D3 R2 R1 R1U1* R1 L1* D1 R2U1 L1D2 L3D4 R4* R2U2 R2 R3* R2 R3U3 R2U3* R2U2' },
  { n: 101, white: 'Brian Silberberg', black: 'Robert Colbert', winner: 'B',
    moves: '0 L1D1 L3 R1D3 D2 L1D3 L1 R1 L2 L4 D3 D1 L1D2 D4* R2U1* R1 R1D5 D3 L2D2* L1D3 L2D3 L2D1 L3D4 D1 L4D5 L5D6 R1D1 L2D4* L2D3 L3D1 L4D1 L2D2 L3D3* L2D2 L1D1* L3D1' },
  { n: 102, white: 'Bill Justice', black: 'Hai-Chou Chen', winner: 'W',
    moves: '0 L1 L4 L1U2 L2D2 R1U1 L3D1 L1D3 L1D1 L1U1 L2D1 L4D1 L2D3 L2 U2* L2 D1 R1D1 U1' },
  { n: 103, white: 'Peter Hudson', black: 'Marvin Cooper', winner: 'B',
    moves: '0 L1D1 L3 L3D1 L2D1 L1D2 L1 L4U1* L1D3* L2 L1U1 L1D1 R1D1 L1U2* D2 R2 L3U1* L1U1 D1 R2D2* D3 0 D4 D5 R1D1 R2D1 R2D3 L2D3 L2U2* L1D1* R1D3 R2D4*' },
  { n: 104, white: 'Dan Allen', black: 'Robert Colbert', winner: 'W',
    moves: '0 R1U1 R3 R3U1 R2U1 R1U2 R1 R4D1* R1U3* R2 R1D1 L1* R4U2* R1U2 R3U3 R2U4 R3U1 R5U1* R2 R4U2 R3U3 R4U4 R6* R4U2 R3U2 R3U4 R3 R3D1 R4 R5 R1' },
  { n: 106, white: 'Marvin Cooper', black: 'Dave Wallace', winner: 'W',
    moves: '0 D1 L2D4 L2D1 L1D3 R1D1 L1D1 L2D2 L3D5 L4D6 R2D1* D2 L1D2 R1U1* L1D4 L1D1 L1D5 L1D6 L3D3 0 R2U2 D6 L3D4 L3D6 L2D6 R1D6 L3D1 L3D2 L4D2*' },
  { n: 107, white: 'Dave Wallace', black: 'Marvin Cooper', winner: 'B',
    moves: '0 R1U1 U3 R1U3 R2 R1U2 R1 L1 R1U5 L1U2 L1U1 L2U2 R2U2 R1D1* R2U1 D1 R3U3 R3U2* R1 L3U2 U2 L2U1' },
  { n: 108, white: 'John Hawkins', black: 'Grady Johnston', winner: 'W',
    moves: '0 R3 R4 R1U2 R2D2 R2U1 U3 R5D2 R4D1 R4D2 R4U1 R2D4 R6D2 R3D2 R3D3 R1D1 R7D3 R8D4 R5D1 R3U1 R3D1' },
  { n: 109, white: 'Grady Johnston', black: 'John Hawkins', winner: 'B',
    moves: '0 R1D1 R3 R3D1 R2D1 R1D2 R1 R4U1* R1D3* R2 R1U1 L1* R4D2* R1D2 R3D3 R5D1 R3D1 R2 R2D2 D4 R4D4 R1D1 R4 R5D3* R3D1 R5U1 R5D5 R6D6 R1* R1D1 R6U1 R3U1 R4U3 R5 R5D2 R5U2' },
  { n: 110, white: 'Rollie Tesh', black: 'Dan Allen', winner: 'W',
    moves: '0 L3D2 L3 L1D4 L4U1 L1 L4D1 L5D2 L2U1 L2D1 U1 L5U2* U2 L4D3 L5D4 D1 R1D2* D1 L1U1 R1U1 L2U2 R1D1 U3 U4 L1U2 L3 L3U2' },
  { n: 111, white: 'Dan Allen', black: 'Rollie Tesh', winner: 'W',
    moves: '0 R1U1 R3 R3U1 R2U1 R1U2 R1 R4D1* R1U3* R2 R1D1 L1* R4U2* R2 L1U1 U2 R1U1 R2U2 R1U2 R1 R1U4 R1U5 0 L1D1* 0 R2D2 R3* R1D2 R1U1 R1 R2U1 L2U1' },
  { n: 112, white: 'Dan Allen', black: 'Rollie Tesh', winner: 'B',
    note: 'Black won by reaching five captures.',
    moves: '0 R1U1 R3 R3U1 R2U1 R1U2 R1 R4D1* R1U3* R2 R1D1 L1* R4U2* R2 L1U1 0 R1 L2 U2 R1D2 R2U4 R3U5 R3U3 R1U1* R1 R5U1 R3D1* D1 L2U1 L4 L3 R2D3 R3D4 L4D1 R1U5 U6 D2 L1U2* U1* R2D1*' },
  { n: 113, white: 'David Comberrel', black: 'Bill Webber', winner: 'B',
    moves: '0 R1U1 U3 D1 R2 L2U1 R1 L1 R1D2 R2U1 R4 R3 R4D1 L1U1 U1 U2* U1 L1D1 L3U1* L1U1 L2U1* 0* R3U1* R1U3 L2 L4U2* L2 L2U2 L3U3 L2D1* L2 L1U2 L3U2 L1D2' },
  { n: 114, white: 'Bill Webber', black: 'David Comberrel', winner: 'W',
    note: 'The booklet\'s last moves (from Black\'s 14th) don\'t fit the rules, so the replay stops there; White won.',
    moves: '0 L1U3 U3 R1U4 U5 R1U5 U4 U2 R1U1 R1U6 U7 U6 L1U7 L1U6 R2U4* U6 L2U6 R1U5 R1U7 R3U6 R2U6 U8 R3U5 R1U3 L1U1* R1D3 R1U2' },
  { n: 115, white: 'John Hawkins', black: 'Marvin Cooper', winner: 'W',
    moves: '0 L1D1 L3 L3D1 L2D1 L1D2 L1 L4U1* L1D3* L2 L1U1 L1D1 R1D1 L1U2* D2 R2 L1U1 L2U2 D3 L2D3 R1D3 R2D4* R1D3 R3D3 R1D2 R1D4 L1D4 L2D5 R2D1 R3 R3D1 R4D1 R4 U1 R5U1 R2D2 R4D4* R2D2 L1D5 L1D6 L3D4 D7 R1* R3D2* R4D2* R2D2 R1' },
  { n: 116, white: 'Marvin Cooper', black: 'John Hawkins', winner: 'B',
    note: 'White\'s last move is printed on a point already taken, so it is left out; Black won.',
    moves: '0 L1D1 L3D2 R1 L2 R1D2 L1 R1D1 L3 L4 R1U1 R2U2* R1U1 R2D1 R3D1 R3 D1* R2D1 R4U1 U1 L1U2 R3D2 R4D3 R2D3 R2' },
  { n: 117, white: 'Bill Webber', black: 'Rollie Tesh', winner: 'B',
    note: 'The booklet\'s last moves (from move 16) don\'t fit the rules, so the replay stops there; Black won.',
    moves: '0 R1U1 U3 L1U1 L2U1 R1U4 L1U2 R1U2 R1U3 R1 R1D2 R2U3 D1 L1U3* R1U3 L1 L1D1* L1 L2D1 R2D3* D1 L2D2* L2U3 L3 L2 U3* L2U1 L2U2 U1 R1D1' },
  { n: 118, white: 'Rollie Tesh', black: 'Bill Webber', winner: 'W',
    moves: '0 R1U1 R3 L1 D2 R1U2 R2 R1 R1D1 R3U1 L1U1 R2D2 D1 R1U3 R1U4 L1D1 L1D2* L1D1 L2U2 L3U3 L2D2 L3D2 L1D3 L1D4* L1D3 R2D1* R1D1 L2D4 D4 L3D1 R2D3* R2D2 L3D4* L2D4 D3 D1 L2D1* D1 L2U1' },
  { n: 119, white: 'Rollie Tesh', black: 'John Hawkins', winner: 'W',
    moves: '0 R1U1 R3 R3U1 R2U1 R1U2 R1 R4D1* R1U3* R2 R1D1 L1* R4U2* R2 R4U4 R1U2 R4U3 R4U1 R2U4 U2 R4D6 R4U5 R3U5 R5U7 R5U3 R6U2 R3U3' },
  { n: 120, white: 'John Hawkins', black: 'Rollie Tesh', winner: 'B',
    moves: '0 U1 R3 R2U3 R1U2 R2U1 R3U2 R1U1 R3U1 R3U3 U2 L2U1 L1U1 R1U3 U3 L1U4* U3 L2* L1U1 R5U3 R4U3 R5U4* R4U3 L2U2' },
  { n: 121, white: 'Marvin Cooper', black: 'Bill Webber', winner: 'W',
    moves: '0 R1U1 R3U2 R3U1 D1 U1 R2U1 R1 L1U1* R1D1 D2 L2U2* 0 U1 L1U2 R2D1 R3D1* R2D1 R2D2 D3 R3D3 R3D2 R4D3 R2D3 R1D3 D4 D5* D4 L1D1 R5D3* R4D3 R1U1 L2 L2D2* L1D1 R4U3* L3U1' },
  { n: 122, white: 'Bill Webber', black: 'Marvin Cooper', winner: 'W',
    moves: '0 L2 L4 R1U1 L2U2 R1D1 L1U1 L1U3 L4U2 R2 L3U3 L4U4 D2 L2U4 R3U1* R1D1 L3U5 U2 R2 R4U2* R2 R1 R1U2 R1D2 R1D3 R2D4 L3U2 L1D1* R1D3 L5U1* L4U2 L5U2 L4U1 L4D1 L5 L6D1 L1U4 L2U3 L2U5* L2U3 U3' },
  { n: 123, white: 'Bill Webber', black: 'Marvin Cooper', winner: 'B',
    moves: '0 L2 L4 R1U1 L2U2 R1D1 L1U1 L1U3 L4U2 R2 L3U3 L4U4 D2 R3U1 R3D1 R5U3 R4U2 L2U4 U2* R1U3* U2 R3U3 U1 D1 U3 U4 R1U5* U4 L1U2 L1U1* L2U2 L3U2 R2U2 R1U2 L1U5* U4 R1 L3U4 L1U4 L2U5* L1U4 L1U6 L2U6 L3U7* L2U6 R2' },
  { n: 124, white: 'David Comberrel', black: 'Dan Allen', winner: 'B',
    moves: '0 L3D1 L3 L1D1 L2D1 L1D2 L1 L4U1* L1D3* L2 L1U1 R1* L4D2* L2 R1D1 0 L1 R2 L1U2 L1U3 D2 R1D2 L2D4 L3D5 L3D3 L1D5 L2D3 D3 L2D5 R3' },
  { n: 125, white: 'Dave Wallace', black: 'Dan Allen', winner: 'W',
    note: 'White won by reaching five captures.',
    moves: '0 R3U1 R3 R1U1 R2U1 R1U2 R1 R4D1* R1U3* R2 R1D1 L1* R4U2* R2 L1U1 0 R1 L2 U2 L1U2 R2U4 R3U5 R2U2 R1U4 U4 L3 L4 U3 L2U1 R3U1 R3U3 R3U6 R2U5 R2U3 R1U1 L1U3* R1U1 R1U2 L1U5 U2* R1U3 L2U6 L3U1 U1 L2U3* U1 L1U2*' },
  { n: 126, white: 'David Comberrel', black: 'Grady Johnston', winner: 'W',
    moves: '0 R1U1 R3 R3U1 R2U1 R1U2 R1 R4D1* R1U3* R2 R1D1 L1* R4U2* R2 L1U1 0 R1 L2 R1D2 R1D3 U2 L1D1 L1D2* L1D1 R1U1 L1U3* R1U1 R1U2 L2D2* L3D2 L1D1' },
  { n: 128, white: 'Robert Colbert', black: 'Robert Argleben', winner: 'W',
    moves: '0 R1U1 R3 R3U1 R2U1 R1U2 R1 R2 R1U3* R4U2 R1D1 R1U1 L1U1 R5U3 R6U4 L2U2 U2 R1D2* R1D1 R2U4 R4D1 R1U2 R4D3 R6D3 R3D3 R2D2 R2D3 R1D3 R1D4* R3D2 R1D3 D5* R2D3' },
  { n: 129, white: 'Peter Hudson', black: 'John Krenz', winner: 'W',
    note: 'Black\'s 20th move is printed on a point already taken, so the replay stops before it; White won.',
    moves: '0 L1U1 L3 L3U1 L2U1 L1U2 L1 L4D1* L1U3* L2 L1D1 R1* L4U2* L2 R1U1 L3U2 L2U1 0 L1 L1U1 U2 R2 L3D1* L1U1 L2U4 L3U5 L3U3 R3 R4 L1D2* L1 L5U1 D1 R2D2 R1D1 R2D1 L1D1 L2D1' },
  { n: 130, white: 'Peter Hudson', black: 'Robert Colbert', winner: 'W',
    moves: '0 R1U1 R3 R3U1 R2U1 R1U2 R1 R4D1* R1U3* R2 R1D1 L1* R4U2* R2 L1U1 0 R1 L2 R1D2 R1U1 U2 R2U2 R3D1* R1U1 R2U4 R3U5 R3U3 R5U1 R3U1 L3 L4 R5U3 R3 R3U2 R1U2* R2* R3U2' },
  { n: 131, white: 'Bill Justice', black: 'Peter Hudson', winner: 'B',
    moves: '0 R4U1 R4 R2U3 R2 R3U2 R3 R1 R5 R6 U1 U2 D1 D2 R2U1 R2D2 R1U1 L1U1 L1D1 R3D1* R1U1 R2U2 R2U4* R2U2 R2U3* R1U2 R4U1 R4D1* R2U1 R4U2* R3U2 R4U3*' },
];

// ---------------------------------------------------------------------------
// Tournament structure and the booklet's openings index (names are the booklet's own,
// "not official, just for reference"; reflections and transpositions count as the same opening).

const OPENING_GAMES = {
  'Wedge': [2, 5, 9, 10, 22, 30, 33, 46, 49, 52, 55, 57, 63, 65, 69, 71, 72, 78, 83, 86, 89, 95, 97, 103, 104, 109, 111, 112, 115, 119, 124, 125, 126, 128, 129, 130],
  'Hammer': [7, 20, 38, 40, 68, 73, 81, 92, 107],
  "Colbert's variation": [6, 31, 50, 53, 101],
  'Krenz attack': [1, 96],
  "Allen's opening": [4, 15, 43, 62, 70, 80, 110],
  "Wallace's opening": [8, 14, 41, 42, 48, 61, 66, 82, 120],
  'Cross': [3, 21, 37, 67, 91, 98, 117],
  "Cooper's opening": [19, 25, 64, 90, 116, 121],
  'Potential': [17, 35, 85, 122, 123],
  'Boston': [44, 113, 118],
  'Dallas': [24, 84, 87, 131],
};
// The defining moves, in the booklet's notation (any reflection counts).
export const OPENING_MOVES = {
  'Wedge': '0 R1U1 R3 R3U1 R2U1',
  'Hammer': '0 R1U1 R3 R3U1 U2',
  "Colbert's variation": '0 R1U1 R3 L1U3',
  'Krenz attack': '0 R1U1 R4 R1D1 R1U2',
  "Allen's opening": '0 R3U2',
  "Wallace's opening": '0 U1 R3 R2U3',
  'Cross': '0 R1U1 R3 R1D1 R1U2',
  "Cooper's opening": '0 R1U1 R3U2',
  'Potential': '0 R2',
  'Boston': '0 R1U1 R3 L1',
  'Dallas': '0 R4U1',
};
const OPENING_OF = {};
for (const [name, list] of Object.entries(OPENING_GAMES)) for (const n of list) OPENING_OF[n] = name;

export function openingOf(n) { return OPENING_OF[n] || 'Irregular'; }

export function roundOf(n) {
  if (n <= 20) return 'Round 1';
  if (n <= 40) return 'Round 2';
  if (n <= 60) return 'Round 3';
  if (n <= 80) return 'Round 4';
  if (n <= 100) return 'Round 5';
  if (n <= 105) return 'Playoff for the final eight';
  if (n <= 114) return 'Quarter-final';
  if (n <= 118) return 'Semi-final';
  if (n <= 120) return 'Final';
  if (n <= 123) return 'Third-place playoff';
  if (n <= 127) return 'Playoff for 5th–8th';
  return 'Consolation event';
}

/** Games whose records replay cleanly (the ones the app shows). */
export const PLAYABLE_1983 = GAMES_1983.filter((g) => !g.doubtful);

export const masterId = (n) => `wc83-${n}`;

/** A review entry (same shape as an archived game) for game n, seen from `side` ('W' or 'B'; default the winner). */
export function masterEntry(n, side) {
  const g = PLAYABLE_1983.find((x) => x.n === n);
  if (!g) return null;
  const COLS_ = COLS;
  const moves = g.moves.trim().split(/\s+/).map((t) => {
    const c = toCoord(t);
    return [COLS_.indexOf(c[0]), 19 - Number(c.slice(1))];
  });
  const view = side === 'W' || side === 'B' ? side : g.winner;
  return {
    id: masterId(n), master: g, variantId: 'pente', options: {}, moves,
    you: view === 'W' ? 1 : 2, level: 4, at: null,
    result: g.winner === view ? 'win' : 'loss',
  };
}
