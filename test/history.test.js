import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, commitHistory, undoHistory, redoHistory } from '../src/history.js';

test('records edits and can undo then redo without losing the future state', () => {
  let history = createHistory({ value: 1 });
  history = commitHistory(history, { value: 2 });
  history = commitHistory(history, { value: 3 });
  history = undoHistory(history);
  assert.equal(history.present.value, 2);
  history = redoHistory(history);
  assert.equal(history.present.value, 3);
});

test('a new edit after undo clears redo history', () => {
  let history = createHistory({ value: 1 });
  history = commitHistory(history, { value: 2 });
  history = undoHistory(history);
  history = commitHistory(history, { value: 9 });
  assert.equal(redoHistory(history).present.value, 9);
});
