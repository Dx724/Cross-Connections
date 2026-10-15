const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const catalog = require('../game.js');
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const empty = () => ({ row: [null, null, null, null], col: [null, null, null, null] });
const transpose = board => [0, 1, 2, 3].flatMap(r => [0, 1, 2, 3].map(c => board[c * 4 + r]));
const permutations = a => a.length ? a.flatMap((x, i) => permutations(a.filter((_, j) => i !== j)).map(y => [x, ...y])) : [[]];
const orders = permutations([0, 1, 2, 3]);
const storageKey = id => `cross-connections-${id}-lines-v2`;

assert.deepEqual(catalog.puzzles.map(p => [p.id, p.number]), [['001', 1], ['002', 2], ['004', 3]]);
assert.deepEqual(catalog.puzzles.map(p => p.number), catalog.puzzles.map((_, index) => index + 1));
// Display numbers can change; persistent IDs, puzzle content and order cannot.
const v9Definitions = require('./fixtures/catalog-v9.json');
assert.deepEqual(catalog.puzzles, v9Definitions.map((definition, index) => ({ ...definition, number: index + 1 })));
assert.equal(catalog.id, '004');
assert.equal(new Set(catalog.puzzles.map(p => p.id)).size, catalog.puzzles.length);
assert.equal(new Set(catalog.puzzles.map(p => p.number)).size, catalog.puzzles.length);
assert.equal(catalog.puzzles[0].id, '001');
assert.equal(catalog.puzzles[0].number, 1);
let checks = 0;
for (const [index, definition] of catalog.puzzles.entries()) {
  assert.equal(typeof definition.id, 'string');
  assert(Number.isInteger(definition.number) && definition.number > 0);
  assert.match(definition.published, /^\d{4}-\d{2}-\d{2}$/);
  if (index) {
    const previous = catalog.puzzles[index - 1];
    assert(previous.published < definition.published || (previous.published === definition.published && previous.number < definition.number));
  }
  assert.equal(definition.solution.length, 4);
  assert(definition.solution.every(row => row.length === 4));
  const puzzle = catalog.create(definition);
  assert.equal(new Set(puzzle.words).size, 16);
  assert(puzzle.words.every(word => typeof word === 'string' && word.length && word.trim() === word));
  for (const type of ['families', 'crosses']) {
    assert.equal(puzzle.names[type].length, 4);
    assert(puzzle.names[type].every(name => typeof name === 'string' && name.length));
  }
  for (const rows of orders) for (const columns of orders) {
    const board = rows.flatMap(r => columns.map(c => puzzle.solution[r][c]));
    for (const [candidate, orientation] of [[board, 'families'], [transpose(board), 'crosses']]) {
      assert(puzzle.check(candidate));
      for (const axis of ['row', 'col']) for (let line = 0; line < 4; line++) assert(puzzle.group(candidate, axis, line, orientation));
      checks++;
    }
  }
  assert(!puzzle.check(puzzle.words.slice(1)));
  assert(!puzzle.check([puzzle.words[1], ...puzzle.words.slice(1)]));
  const bad = puzzle.words.slice();
  [bad[0], bad[5]] = [bad[5], bad[0]];
  assert(!puzzle.check(bad));
  assert.equal(puzzle.group(bad, 'row', 0), null);
  const locks = empty();
  locks.row[0] = puzzle.group(puzzle.words, 'row', 0);
  assert(puzzle.canSwap(puzzle.words, 0, 1, locks));
  assert(!puzzle.canSwap(puzzle.words, 0, 4, locks));
  locks.col[0] = puzzle.group(puzzle.words, 'col', 0);
  assert(!puzzle.canSwap(puzzle.words, 0, 1, locks));
  assert(puzzle.canSwap(puzzle.words, 4, 8, locks));
  for (let n = 0; n < 25; n++) {
    const mixed = puzzle.constrainedShuffle(puzzle.words, locks);
    assert.equal(puzzle.group(mixed, 'row', 0, 'families').id, 0);
    assert.equal(puzzle.group(mixed, 'col', 0, 'families').id, 0);
    assert.deepEqual([...mixed].sort(), [...puzzle.words].sort());
  }
}
console.log(`Validated ${catalog.puzzles.length} puzzle definitions and ${checks} complete row/column permutations, including transposition, constrained swaps, and shuffle.`);

// Exercise actual application handlers with an in-memory DOM and storage.
class El {
  constructor() { this.children = []; this.classList = { add() {}, remove() {} }; this.dataset = {}; this.style = {}; }
  replaceChildren() { this.children = []; }
  append(x) { this.children.push(x); }
  setAttribute() {}
  addEventListener() {}
  focus() {}
  showModal() {}
  close() {}
  scrollIntoView() {}
}
function harness(saves = new Map(), puzzles = catalog) {
  const elements = new Map();
  const get = id => { if (!elements.has(id)) elements.set(id, new El()); return elements.get(id); };
  const document = { getElementById: get, querySelector: get, querySelectorAll: () => [], createElement: () => new El(), addEventListener() {}, body: new El() };
  const context = { Puzzle: puzzles, document, localStorage: { getItem: key => saves.get(key), setItem: (key, value) => saves.set(key, value) }, setTimeout };
  vm.createContext(context);
  vm.runInContext(app, context);
  const run = expression => vm.runInContext(expression, context);
  return { get, run, saves, snapshot: () => JSON.parse(saves.get(run('storageKey'))) };
}
const h = harness();
const newest = catalog.puzzles.at(-1);
assert.equal(h.run('activePuzzle.id'), newest.id);
assert(h.get('next-puzzle').disabled);
assert(!h.get('previous-puzzle').disabled);
assert.equal(h.get('edition').textContent, `No. ${String(newest.number).padStart(3, '0')}${newest.placeholder ? ' · Placeholder' : ''}`);
h.run('changePuzzle(0)');
h.run('state.board=activePuzzle.words.slice();render();selectLine("row",0)');
assert.equal(h.run('selection.axis'), 'row');
h.run('selectLine("row",0)');
assert.equal(h.run('selection'), null);
assert(h.get('submit').disabled);
h.run('selectLine("col",1);selectLine("col",1)');
assert.equal(h.run('selection'), null);
h.run('selectLine("row",0)');
h.get('submit').onclick();
assert.equal(h.snapshot().mistakes, 0);
assert.equal(h.snapshot().locks.row[0].name, catalog.puzzles[0].names.families[0]);
assert(h.get('submit').disabled);
h.run('swap(0,1)');
assert.equal(h.snapshot().board[0], catalog.puzzles[0].solution[0][1]);
h.run('swap(0,4)');
assert.equal(h.snapshot().board[0], catalog.puzzles[0].solution[0][1]);
assert.equal(h.snapshot().mistakes, 0);

// Every published puzzle is winnable through all eight real submit handlers in either orientation.
for (let index = 0; index < catalog.puzzles.length; index++) {
  h.run(`changePuzzle(${index})`);
  for (const transposed of [false, true]) {
    h.get('replay').onclick();
    h.run(`state.board=${JSON.stringify(transposed ? transpose(catalog.puzzles[index].solution.flat()) : catalog.puzzles[index].solution.flat())};render()`);
    for (const axis of ['row', 'col']) for (let line = 0; line < 4; line++) {
      h.run(`selectLine('${axis}',${line})`);
      h.get('submit').onclick();
    }
    assert.equal(h.snapshot().status, 'won');
    assert.equal(h.snapshot().mistakes, 0);
    assert(h.snapshot().locks.row.every(Boolean));
    assert(h.snapshot().locks.col.every(Boolean));
    assert(h.run('validState(state)'));
  }
}
h.get('replay').onclick();
h.run('state.board=activePuzzle.words.slice();[state.board[0],state.board[5]]=[state.board[5],state.board[0]];render();selectLine("row",0)');
for (let i = 4; i < 13; i++) {
  arrangeLine(h, [0, 1, 2, i]);
  h.get('submit').onclick();
}
assert.equal(h.snapshot().mistakes, 9);
assert.equal(h.snapshot().status, 'lost');
h.get('submit').onclick();
assert.equal(h.snapshot().mistakes, 9);
assert(h.run('validState(state)'));
h.get('replay').onclick();
assert.equal(h.snapshot().mistakes, 0);
assert.equal(h.snapshot().status, 'playing');
assert(!h.run('validState({...state,mistakes:9})'));
h.run('state.board=activePuzzle.words.slice();render();selectLine("col",0)');
h.get('submit').onclick();
assert.equal(h.snapshot().orientation, 'families');
assert.equal(h.snapshot().locks.col[0].type, 'crosses');
assert(h.run('validState(state)'));
console.log('Passed actual handlers for all-eight-group wins on every puzzle in both orientations, nine-mistake loss, replay, arrow deselection, and persisted-state validation.');

// Each puzzle retains independent board, mistakes, locks, and orientation across navigation/reloads.
const expected = new Map();
for (let index = 0; index < catalog.puzzles.length; index++) {
  h.run(`changePuzzle(${index})`);
  h.get('replay').onclick();
  h.run(`state.board=activePuzzle.words.slice();state.mistakes=${index % 3};render();selectLine("row",0)`);
  h.get('submit').onclick();
  expected.set(catalog.puzzles[index].id, h.saves.get(storageKey(catalog.puzzles[index].id)));
}
for (let index = catalog.puzzles.length - 1; index >= 0; index--) {
  if (index !== catalog.puzzles.length - 1) h.get('previous-puzzle').onclick();
  assert.equal(h.run('activePuzzle.id'), catalog.puzzles[index].id);
  assert.equal(h.saves.get(storageKey(catalog.puzzles[index].id)), expected.get(catalog.puzzles[index].id));
  assert.equal(h.get('previous-puzzle').disabled, index === 0);
  assert.equal(h.get('next-puzzle').disabled, index === catalog.puzzles.length - 1);
  if (index !== catalog.puzzles.length - 1) assert.equal(h.run('selection'), null);
  assert(h.get('solution').hidden);
}
h.run('changePuzzle(-1)');
assert.equal(h.run('activePuzzle.id'), '001');
for (let index = 1; index < catalog.puzzles.length; index++) {
  h.get('next-puzzle').onclick();
  assert.equal(h.run('activePuzzle.id'), catalog.puzzles[index].id);
  assert.equal(h.saves.get(storageKey(catalog.puzzles[index].id)), expected.get(catalog.puzzles[index].id));
}
h.run(`changePuzzle(${catalog.puzzles.length})`);
assert.equal(h.run('activePuzzle.id'), newest.id);
h.run('changePuzzle(0)');
const reload = harness(h.saves);
assert.equal(reload.run('activePuzzle.id'), newest.id);
for (let index = 0; index < catalog.puzzles.length; index++) {
  reload.run(`changePuzzle(${index})`);
  assert.equal(reload.saves.get(storageKey(catalog.puzzles[index].id)), expected.get(catalog.puzzles[index].id));
}
console.log('Passed newest-on-load/reload, navigation boundaries, independent progress and locks on every puzzle, and selection/solution reset.');

// Visible 001–002–003 uses persistent IDs 001, 002, 004 and never reuses retired003 storage.
const retiredProgress = JSON.stringify({ retiredPuzzle: '003', preserve: 'original saved state' });
const retirementSaves = new Map(h.saves);
retirementSaves.set(storageKey('003'), retiredProgress);
const retainedProgress = new Map(retirementSaves);
const retirement = harness(retirementSaves);
for (const [expectedId, label] of [['004', '003'], ['002', '002'], ['001', '001']]) {
  assert.equal(retirement.run('activePuzzle.id'), expectedId);
  assert.equal(retirement.get('edition').textContent, `No. ${label}`);
  assert.equal(retirement.saves.get(storageKey(expectedId)), retainedProgress.get(storageKey(expectedId)));
  retirement.get('previous-puzzle').onclick();
}
for (const [expectedId, label] of [['001', '001'], ['002', '002'], ['004', '003']]) {
  assert.equal(retirement.run('activePuzzle.id'), expectedId);
  assert.equal(retirement.get('edition').textContent, `No. ${label}`);
  assert.equal(retirement.saves.get(storageKey(expectedId)), retainedProgress.get(storageKey(expectedId)));
  retirement.get('next-puzzle').onclick();
}
assert.equal(retirement.saves.get(storageKey('003')), retiredProgress);
assert.equal(harness(retirement.saves).run('activePuzzle.id'), '004');
assert.equal(harness(retirement.saves).get('edition').textContent, 'No. 003');
assert.deepEqual([...retirement.saves], [...retainedProgress]);
// Even a valid save under retired003 must not override 004 or be inherited when 004 is absent.
const conflictingRetiredState = { ...retirement.snapshot(), mistakes: 8, history: [] };
const conflictingRetiredProgress = JSON.stringify(conflictingRetiredState);
const conflictingSaves = new Map(retirement.saves);
conflictingSaves.set(storageKey('003'), conflictingRetiredProgress);
const conflict = harness(conflictingSaves);
assert.deepEqual(conflict.snapshot(), retirement.snapshot());
assert.equal(conflict.saves.get(storageKey('003')), conflictingRetiredProgress);
const retiredOnly = harness(new Map([[storageKey('003'), conflictingRetiredProgress]]));
assert.equal(retiredOnly.get('edition').textContent, 'No. 003');
assert.equal(retiredOnly.run('storageKey'), storageKey('004'));
assert.equal(retiredOnly.snapshot().mistakes, 0);
assert.deepEqual(retiredOnly.snapshot().history, []);
assert.deepEqual(retiredOnly.snapshot().locks, empty());
assert.equal(retiredOnly.saves.get(storageKey('003')), conflictingRetiredProgress);
console.log('Passed 001–002–003 display navigation in both directions, exact preserved 004 progress/reload, and retired003 storage isolation with and without an existing 004 save.');


// Replacing the navigation placeholder must never inherit its old progress or reset puzzle001.
const secondIndex = catalog.puzzles.findIndex(p => p.id === '002');
if (secondIndex !== -1) {
  const priorSaves = new Map(h.saves);
  const originalProgress = priorSaves.get(storageKey('001'));
  priorSaves.delete(storageKey('002'));
  priorSaves.set(storageKey('002-placeholder'), JSON.stringify({ board: Array.from({ length: 16 }, (_, i) => `OLD ${i}`), mistakes: 4, status: 'lost', orientation: null, locks: empty() }));
  const migrated = harness(priorSaves);
  migrated.run(`changePuzzle(${secondIndex})`);
  assert.equal(migrated.run('activePuzzle.id'), '002');
  assert.equal(migrated.snapshot().mistakes, 0);
  assert.equal(migrated.snapshot().status, 'playing');
  assert(migrated.snapshot().board.every(word => catalog.create(catalog.puzzles[secondIndex]).words.includes(word)));
  migrated.run('changePuzzle(0)');
  assert.equal(migrated.saves.get(storageKey('001')), originalProgress);
  console.log('Passed placeholder replacement isolation and preserved puzzle001 progress.');
}

// Counts are unordered set overlap with either family, never matching grid positions.
let overlapChecks = 0;
for (const definition of catalog.puzzles) {
  const puzzle = catalog.create(definition);
  const allGroups = [...definition.solution, ...[0, 1, 2, 3].map(c => definition.solution.map(row => row[c]))];
  for (let a = 0; a < 13; a++) for (let b = a + 1; b < 14; b++) for (let c = b + 1; c < 15; c++) for (let d = c + 1; d < 16; d++) {
    const selected = [a, b, c, d].map(i => puzzle.words[i]);
    const expected = Math.max(...allGroups.map(group => group.filter(word => selected.includes(word)).length));
    assert.equal(puzzle.bestMatch(selected), expected);
    assert.equal(puzzle.bestMatch([...selected].reverse()), expected);
    overlapChecks++;
  }
  assert.equal(puzzle.bestMatch([0, 1, 2, 5].map(i => puzzle.words[i])), 3);
  assert.equal(puzzle.bestMatch([0, 1, 6, 7].map(i => puzzle.words[i])), 2);
  assert.equal(puzzle.bestMatch([0, 4, 8, 13].map(i => puzzle.words[i])), 3);
  assert.equal(puzzle.bestMatch([0, 5, 10, 15].map(i => puzzle.words[i])), 1);
  assert.equal(puzzle.bestMatch([0, 4, 8, 12].map(i => puzzle.words[i])), 4);
}
console.log(`Passed best-match counts for all ${overlapChecks} four-word combinations and their reverse orders, across both axes of every puzzle.`);

function arrangeLine(h, indices, axis = 'row', index = 0) {
  h.run(`{
    const chosen=${JSON.stringify(indices)}.map(i=>activePuzzle.words[i]);
    const remainder=activePuzzle.words.filter(word=>!chosen.includes(word));
    const line=lineIndices('${axis}',${index});
    state.board=Array.from({length:16},(_,i)=>line.includes(i)?chosen[line.indexOf(i)]:remainder.shift());
    selection=null;render();selectLine('${axis}',${index});
  }`);
}
const historyGame = harness();
for (const axis of ['row', 'col']) {
  historyGame.get('replay').onclick();
  arrangeLine(historyGame, [2, 0, 5, 1], axis);
  const firstWords = historyGame.run(`JSON.stringify(lineIndices('${axis}',0).map(i=>state.board[i]))`);
  historyGame.get('submit').onclick();
  assert.match(historyGame.get('feedback').textContent, /^One away\. 3 of 4 words match a group\./);
  assert.equal(historyGame.snapshot().history.length, 1);
  assert.equal(historyGame.snapshot().history[0].correct, 3);
  assert.equal(JSON.stringify(historyGame.snapshot().history[0].words), firstWords);
  assert.equal(historyGame.get('check-history').children[0].children[1].textContent, 'One away');
  // Repeating a failed check reports its prior result without another mistake or entry.
  historyGame.get('submit').onclick();
  assert.equal(historyGame.snapshot().history.length, 1);
  assert.equal(historyGame.snapshot().mistakes, 1);
  assert.match(historyGame.get('feedback').textContent, /^Already checked\. One away\. No mistake used\.$/);
  arrangeLine(historyGame, [0, 1, 6, 7], axis);
  historyGame.get('submit').onclick();
  assert.match(historyGame.get('feedback').textContent, /^Two away\. 2 of 4 words match a group\./);
  assert.equal(historyGame.snapshot().history[1].correct, 2);
  arrangeLine(historyGame, [0, 5, 10, 15], axis);
  historyGame.get('submit').onclick();
  assert.match(historyGame.get('feedback').textContent, /^Three away\. 1 of 4 words match a group\./);
  assert.equal(historyGame.snapshot().mistakes, 3);
  assert.equal(historyGame.snapshot().status, 'playing');
  // A correct group does not enter the log or spend another mistake.
  arrangeLine(historyGame, [0, 1, 2, 3], axis);
  historyGame.get('submit').onclick();
  assert.equal(historyGame.snapshot().history.length, 3);
  assert.equal(historyGame.snapshot().mistakes, 3);
  assert.equal(historyGame.snapshot().locks[axis][0].type, 'families');
  assert(historyGame.run('validState(state)'));
  const savedHistory = historyGame.snapshot().history;
  const reloaded = harness(historyGame.saves);
  assert.deepEqual(reloaded.snapshot().history, savedHistory);
  assert.equal(reloaded.get('check-history').children.length, 3);
  assert(reloaded.get('history-empty').hidden);
}

// The locked orientation cannot turn an opposite-axis 3/4 match into a worse hint.
historyGame.get('replay').onclick();
historyGame.run('state.orientation="families"');
arrangeLine(historyGame, [0, 4, 8, 13]);
historyGame.get('submit').onclick();
assert.equal(historyGame.snapshot().history[0].correct, 3);
assert.match(historyGame.get('feedback').textContent, /^One away/);
// A complete opposite-axis group is still 4/4 and is omitted, with useful direction feedback.
arrangeLine(historyGame, [0, 4, 8, 12]);
historyGame.get('submit').onclick();
assert.equal(historyGame.snapshot().history.length, 1);
assert.match(historyGame.get('feedback').textContent, /^These four words form a group in the other direction/);
assert(historyGame.run('validState(state)'));

historyGame.get('replay').onclick();
for (let i = 1; i <= 9; i++) {
  arrangeLine(historyGame, [0, 1, 2, i + 3]);
  historyGame.get('submit').onclick();
  assert.equal(historyGame.snapshot().mistakes, i);
  assert.equal(historyGame.snapshot().history.length, i);
  assert.equal(historyGame.snapshot().status, i === 9 ? 'lost' : 'playing');
  assert(historyGame.run('validState(state)'));
}
assert.match(historyGame.get('feedback').textContent, /^One away\. 3 of 4 words match a group\. Out of mistakes/);
assert.equal(historyGame.get('instruction').textContent, 'Nine mistakes complete');
assert.equal(harness(historyGame.saves).snapshot().status, 'lost');
historyGame.get('submit').onclick();
assert.equal(historyGame.snapshot().history.length, 9);
historyGame.get('replay').onclick();
assert.deepEqual(historyGame.snapshot().history, []);
assert.equal(historyGame.get('check-history').children.length, 0);
assert(!historyGame.get('history-empty').hidden);
console.log('Passed actual row/column hints, unique chronological checks and free repeats, no correct groups in history, 4/4 opposite-direction handling, nine-mistake loss/reload, and replay clearing.');

// Histories remain isolated and are restored for every catalog entry.
const histories = new Map();
for (let index = 0; index < catalog.puzzles.length; index++) {
  historyGame.run(`changePuzzle(${index})`);
  historyGame.get('replay').onclick();
  for (let attempt = 0; attempt <= index; attempt++) {
    arrangeLine(historyGame, [0, 1, 2, attempt + 4]);
    historyGame.get('submit').onclick();
  }
  histories.set(catalog.puzzles[index].id, historyGame.saves.get(storageKey(catalog.puzzles[index].id)));
}
const historyReload = harness(historyGame.saves);
for (let index = 0; index < catalog.puzzles.length; index++) {
  historyReload.run(`changePuzzle(${index})`);
  assert.equal(historyReload.saves.get(storageKey(catalog.puzzles[index].id)), histories.get(catalog.puzzles[index].id));
  assert.equal(historyReload.get('check-history').children.length, index + 1);
}
historyReload.get('replay').onclick();
for (let index = 0; index < catalog.puzzles.length - 1; index++) {
  assert.equal(historyReload.saves.get(storageKey(catalog.puzzles[index].id)), histories.get(catalog.puzzles[index].id));
}
console.log('Passed independent chronological history on all active puzzles, navigation/reload restoration, and puzzle-local reset.');

// Existing saves are upgraded in place, retaining old wins and reviving four-mistake losses.
for (const status of ['playing', 'won', 'lost']) {
  const legacySaves = new Map();
  const legacyStates = new Map();
  for (const definition of catalog.puzzles) {
    const puzzle = catalog.create(definition);
    const locks = empty();
    locks.row[0] = puzzle.group(puzzle.words, 'row', 0, 'families');
    if (status === 'won') for (const axis of ['row', 'col']) for (let i = 0; i < 4; i++) locks[axis][i] = puzzle.group(puzzle.words, axis, i, 'families');
    const legacy = { board: puzzle.words.slice(), mistakes: status === 'lost' ? 4 : 2, status, orientation: 'families', locks };
    legacyStates.set(definition.id, legacy);
    legacySaves.set(storageKey(definition.id), JSON.stringify(legacy));
  }
  const upgraded = harness(legacySaves);
  for (let index = 0; index < catalog.puzzles.length; index++) {
    upgraded.run(`changePuzzle(${index})`);
    const original = legacyStates.get(catalog.puzzles[index].id);
    const saved = upgraded.snapshot();
    assert.deepEqual(saved.board, original.board);
    assert.deepEqual(saved.locks, original.locks);
    assert.equal(saved.orientation, original.orientation);
    assert.equal(saved.mistakes, original.mistakes);
    assert.equal(saved.status, status === 'lost' ? 'playing' : status);
    assert.deepEqual(saved.history, []);
    assert.equal(saved.version, 3);
    assert(upgraded.run('validState(state)'));
    if (status === 'lost') {
      assert.equal(upgraded.get('tries').textContent, '5 mistakes left');
      // Resume through five real checks while retaining the old locked group.
      for (let remaining = 4; remaining >= 0; remaining--) {
        arrangeLine(upgraded, [4, 5, 6, 12 - remaining], 'row', 1);
        upgraded.get('submit').onclick();
        assert.equal(upgraded.snapshot().mistakes, 9 - remaining);
        assert.equal(upgraded.snapshot().status, remaining === 0 ? 'lost' : 'playing');
      }
      assert.deepEqual(upgraded.snapshot().locks, original.locks);
      assert.equal(upgraded.snapshot().history.length, 5);
    }
  }
  const again = harness(legacySaves);
  for (let index = 0; index < catalog.puzzles.length; index++) {
    again.run(`changePuzzle(${index})`);
    assert.equal(again.snapshot().status, status);
    assert(again.run('validState(state)'));
  }
}
console.log('Passed migration of old playing/won/lost saves for all active puzzles, preservation of boards/locks/mistakes, resumed play to nine, and no repeated revival on reload.');

// The same failed SET is free in every order, line and direction, even after reloads.
let repeatChecks = 0;
for (let puzzleIndex = 0; puzzleIndex < catalog.puzzles.length; puzzleIndex++) {
  let game = harness();
  game.run(`changePuzzle(${puzzleIndex})`);
  for (const indices of [[0, 1, 2, 5], [0, 1, 6, 7], [0, 5, 10, 15]]) {
    game.get('replay').onclick();
    arrangeLine(game, indices);
    game.get('submit').onclick();
    const original = game.snapshot();
    assert.equal(original.mistakes, 1);
    assert.equal(original.history.length, 1);
    for (const order of orders) for (const axis of ['row', 'col']) for (let index = 0; index < 4; index++) {
      arrangeLine(game, order.map(i => indices[i]), axis, index);
      game.get('submit').onclick();
      assert.equal(game.snapshot().mistakes, 1);
      assert.deepEqual(game.snapshot().history, original.history);
      assert.equal(game.snapshot().status, 'playing');
      assert.match(game.get('feedback').textContent, /^Already checked\./);
      assert.match(game.get('feedback').textContent, new RegExp(['', 'Three away', 'Two away', 'One away'][original.history[0].correct]));
      assert.doesNotMatch(game.get('feedback').textContent, /of 4/);
      assert.equal(game.get('check-history').children[0].children[1].textContent, ['', 'Three away', 'Two away', 'One away'][original.history[0].correct]);
      assert(game.run('validState(state)'));
      repeatChecks++;
    }
    game = harness(game.saves);
    game.run(`changePuzzle(${puzzleIndex})`);
    arrangeLine(game, [...indices].reverse(), 'col', 3);
    game.get('submit').onclick();
    assert.equal(game.snapshot().mistakes, 1);
    assert.deepEqual(game.snapshot().history, original.history);
    assert.match(game.get('feedback').textContent, /^Already checked\./);
    // Choosing a correct group afterward is still accepted and adds no failed history.
    arrangeLine(game, [0, 1, 2, 3]);
    game.get('submit').onclick();
    assert(game.snapshot().locks.row[0]);
    assert.equal(game.snapshot().mistakes, 1);
    assert.deepEqual(game.snapshot().history, original.history);
    game.get('replay').onclick();
    arrangeLine(game, indices);
    game.get('submit').onclick();
    assert.equal(game.snapshot().mistakes, 1);
    assert.equal(game.snapshot().history.length, 1);
    assert.doesNotMatch(game.get('feedback').textContent, /^Already checked\./);
  }
}
console.log(`Passed ${repeatChecks} free repeats across every order, row/column position, match count, and puzzle, plus reload, correct checks, and replay forgetting.`);

// A repeat on the last available mistake remains free; a different wrong set ends play.
const finalChance = harness();
for (let i = 4; i < 12; i++) {
  arrangeLine(finalChance, [0, 1, 2, i]);
  finalChance.get('submit').onclick();
}
arrangeLine(finalChance, [4, 2, 1, 0], 'col', 2);
finalChance.get('submit').onclick();
assert.equal(finalChance.snapshot().mistakes, 8);
assert.equal(finalChance.snapshot().history.length, 8);
assert.equal(finalChance.snapshot().status, 'playing');
assert.equal(finalChance.get('tries').textContent, '1 mistake left');
arrangeLine(finalChance, [0, 1, 2, 12]);
finalChance.get('submit').onclick();
assert.equal(finalChance.snapshot().mistakes, 9);
assert.equal(finalChance.snapshot().status, 'lost');

// Older version-3 histories can already contain duplicate entries. Preserve all progress,
// including previously spent mistakes, while preventing any new duplicate charges.
const historical = harness();
arrangeLine(historical, [0, 1, 2, 5]);
historical.get('submit').onclick();
historical.run('state.history.push({...state.history[0],words:state.history[0].words.slice().reverse()});state.mistakes=2;render()');
const oldSave = historical.snapshot();
const resumed = harness(historical.saves);
assert.deepEqual(resumed.snapshot(), oldSave);
arrangeLine(resumed, [5, 0, 2, 1], 'col');
resumed.get('submit').onclick();
assert.equal(resumed.snapshot().mistakes, 2);
assert.deepEqual(resumed.snapshot().history, oldSave.history);
assert.match(resumed.get('feedback').textContent, /^Already checked\./);
assert(resumed.run('validState(state)'));

// Even identical words in separate puzzles must have independent failed-group memory.
const sharedWordsCatalog = { ...catalog, puzzles: [catalog.puzzles[0], { ...catalog.puzzles[0], id: 'test-same-words', number: 2 }] };
const isolated = harness(new Map(), sharedWordsCatalog);
arrangeLine(isolated, [0, 1, 2, 5]);
isolated.get('submit').onclick();
isolated.run('changePuzzle(0)');
arrangeLine(isolated, [5, 2, 1, 0], 'col');
isolated.get('submit').onclick();
assert.equal(isolated.snapshot().mistakes, 1);
assert.equal(isolated.snapshot().history.length, 1);
assert.doesNotMatch(isolated.get('feedback').textContent, /^Already checked\./);
isolated.run('changePuzzle(1)');
arrangeLine(isolated, [5, 2, 1, 0], 'col');
isolated.get('submit').onclick();
assert.equal(isolated.snapshot().mistakes, 1);
assert.equal(isolated.snapshot().history.length, 1);
assert.match(isolated.get('feedback').textContent, /^Already checked\./);
isolated.get('replay').onclick();
isolated.run('changePuzzle(0)');
arrangeLine(isolated, [0, 1, 2, 5]);
isolated.get('submit').onclick();
assert.equal(isolated.snapshot().mistakes, 1);
assert.match(isolated.get('feedback').textContent, /^Already checked\./);
console.log('Passed last-mistake protection, existing duplicate-history preservation, and independent memory/reset for puzzles sharing identical words.');

// The approved 004 revision changes exactly two cells and one category label.
const v8Definitions = require('./fixtures/catalog-v8.json');
const expectedDefinitions = JSON.parse(JSON.stringify(v8Definitions));
expectedDefinitions[2].solution[2][0] = 'CHOP';
expectedDefinitions[2].solution[2][1] = 'KICK';
expectedDefinitions[2].names.families[2] = 'Combat actions';
expectedDefinitions[2].number = 3;
assert.deepEqual(catalog.puzzles, expectedDefinitions);
const old004 = catalog.create(v8Definitions[2]);
const new004 = catalog.create(catalog.puzzles[2]);
const replacements = { GLUE: 'CHOP', SKATE: 'KICK' };
const rename004 = word => replacements[word] || word;
assert.equal(new004.solution[2][0] + 'STICK', 'CHOPSTICK');
assert.equal(new004.solution[2][1] + 'BOARD', 'KICKBOARD');
assert.deepEqual(new004.solution[2], ['CHOP', 'KICK', 'DODGE', 'GRAB']);

// Every old four-word set retains its match count, including every failed history.
let migratedHistories = 0;
for (let a = 0; a < 13; a++) for (let b = a + 1; b < 14; b++) for (let c = b + 1; c < 15; c++) for (let d = c + 1; d < 16; d++) {
  const oldWords = [a, b, c, d].map(i => old004.words[i]);
  const correct = old004.bestMatch(oldWords);
  assert.equal(new004.bestMatch(oldWords.map(rename004)), correct);
  if (correct === 4) continue;
  const legacy = { version: 3, board: [...oldWords, ...old004.words.filter(w => !oldWords.includes(w))], mistakes: 2, status: 'playing', orientation: null, locks: empty(), history: [{ words: oldWords, correct }, { words: oldWords.slice().reverse(), correct }] };
  const saves = new Map([[storageKey('004'), JSON.stringify(legacy)], [storageKey('003'), retiredProgress]]);
  for (const id of ['001', '002']) saves.set(storageKey(id), histories.get(id));
  const upgraded = harness(saves);
  const expected = { ...legacy, board: legacy.board.map(rename004), history: legacy.history.map(attempt => ({ ...attempt, words: attempt.words.map(rename004) })) };
  assert.deepEqual(upgraded.snapshot(), expected);
  assert.equal(upgraded.get('check-history').children.length, 2);
  upgraded.run('selectLine("row",0)');
  upgraded.get('submit').onclick();
  assert.deepEqual(upgraded.snapshot(), expected);
  assert.match(upgraded.get('feedback').textContent, /^Already checked\./);
  assert.deepEqual(harness(saves).snapshot(), expected);
  for (const id of ['001', '002']) assert.equal(saves.get(storageKey(id)), histories.get(id));
  assert.equal(saves.get(storageKey('003')), retiredProgress);
  migratedHistories++;
}

// Preserve all valid lock identities, orientation, mistakes, status, and placement.
// Cover both orientations, shuffled valid rows/columns, wins/losses and four-mistake saves.
let migratedStates = 0;
for (const transposed of [false, true]) for (const order of orders) for (const status of ['playing', 'won', 'lost']) for (const legacyVersion of [true, false]) {
  const arranged = order.flatMap(r => order.slice().reverse().map(c => old004.solution[r][c]));
  const board = transposed ? transpose(arranged) : arranged;
  const orientation = transposed ? 'crosses' : 'families';
  const locks = empty();
  for (const axis of ['row', 'col']) for (let i = 0; i < 4; i++) {
    const lock = old004.group(board, axis, i, orientation);
    if (status === 'won' || lock.id === 2 || (lock.type === 'crosses' && lock.id === 0)) locks[axis][i] = lock;
  }
  const legacy = { board, mistakes: status === 'lost' ? (legacyVersion ? 4 : 9) : 2, status, orientation, locks };
  if (!legacyVersion) Object.assign(legacy, { version: 3, history: [{ words: ['GLUE', 'SKATE', 'DODGE', 'LIP'], correct: 3 }, { words: ['LIP', 'DODGE', 'SKATE', 'GLUE'], correct: 3 }] });
  const upgraded = harness(new Map([[storageKey('004'), JSON.stringify(legacy)]]));
  const result = upgraded.snapshot();
  assert.deepEqual(result.board, board.map(rename004));
  assert.equal(result.mistakes, legacy.mistakes);
  assert.equal(result.status, legacyVersion && status === 'lost' ? 'playing' : status);
  assert.equal(result.orientation, orientation);
  assert.equal(result.version, 3);
  assert.deepEqual(result.history, (legacy.history || []).map(attempt => ({ ...attempt, words: attempt.words.map(rename004) })));
  for (const axis of ['row', 'col']) for (let i = 0; i < 4; i++) {
    const oldLock = locks[axis][i];
    assert.deepEqual(result.locks[axis][i], oldLock ? { ...oldLock, name: new004.names[oldLock.type][oldLock.id] } : null);
  }
  assert(upgraded.run('validState(state)'));
  assert(!JSON.stringify(result).includes('GLUE'));
  assert(!JSON.stringify(result).includes('SKATE'));
  assert(!JSON.stringify(result).includes('Verbs'));
  assert.deepEqual(harness(upgraded.saves).snapshot(), result);
  upgraded.run('changePuzzle(1);changePuzzle(2)');
  assert.deepEqual(upgraded.snapshot(), result);
  migratedStates++;
}
console.log(`Passed exact approved 004 delta and unchanged 001/002, CHOPSTICK/KICKBOARD compounds, all 1820 set overlaps, ${migratedHistories} migrated duplicate histories/free retries, and ${migratedStates} old saves with locks, labels, placements, wins/losses, reloads and navigation intact.`);
