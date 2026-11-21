// Small builders for lesson content (see lessons.js for what each step type means).
export const read = (title, text, board) => ({ type: 'read', title, text, board });
export const puzzle = (title, level, setup, stages) => ({ type: 'puzzle', title, level, setup, stages });
export const stage = (prompt, goal, answer, hint, success, reply) => ({ prompt, goal, answer, hint, success, reply });
export const play = (title, text, game, goal = 'win') => ({ type: 'play', title, text, game, goal });
export const G = (kind, extra = {}) => ({ kind, ...extra });
export const ALL = (...goals) => ({ all: goals });
